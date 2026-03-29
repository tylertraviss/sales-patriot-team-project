const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

// ---------------------------------------------------------------------------
// GET /api/analytics/investment-scores
// Ranks vendors by a composite score from the materialized views.
// Score components: award_velocity, contract_value_growth (yoy_growth_pct),
//                   agency_diversification, setaside_graduation
// ---------------------------------------------------------------------------
router.get('/investment-scores', async (req, res, next) => {
  try {
    const {
      year, state_code, naics_code,
      limit = '25',
    } = req.query;

    const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 25));
    const conditions = [`s.cage_code IS NOT NULL`];
    const values     = [];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`s.latest_fiscal_year = $${values.length}`);
    }
    if (state_code) {
      values.push(state_code.toUpperCase());
      conditions.push(`v.state_code = $${values.length}`);
    }
    if (naics_code) {
      // Filter vendors who have awards in this NAICS code
      values.push(naics_code);
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id AND a.naics_code = $${values.length}
      )`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Composite score (0–100) weighted across 4 signals:
    //   award_velocity      (25%) — award_count relative to dataset max
    //   contract_value_growth (25%) — yoy_growth_pct clamped to 0–100
    //   agency_diversification (25%) — distinct_contracting_agencies relative to max
    //   setaside_graduation  (25%) — proxied by total_obligated scale (placeholder until set-aside history table exists)
    const result = await db.query(`
      WITH scored AS (
        SELECT
          s.cage_code,
          s.uei,
          s.company_name                                                     AS name,
          v.state_code,
          s.latest_fiscal_year,
          s.cached_at,
          s.award_count,
          s.total_obligated_amount,
          s.yoy_growth_pct,
          s.distinct_contracting_agencies,
          -- Normalise each signal to 0–100 using window functions
          ROUND(100.0 * s.award_count
            / NULLIF(MAX(s.award_count) OVER (), 0), 2)                     AS award_velocity,
          ROUND(LEAST(GREATEST(COALESCE(s.yoy_growth_pct, 0), 0), 100), 2) AS contract_value_growth,
          ROUND(100.0 * s.distinct_contracting_agencies
            / NULLIF(MAX(s.distinct_contracting_agencies) OVER (), 0), 2)   AS agency_diversification,
          ROUND(100.0 * s.total_obligated_amount
            / NULLIF(MAX(s.total_obligated_amount) OVER (), 0), 2)          AS setaside_graduation
        FROM vendor_investment_summary s
        JOIN vendor_entities v ON v.cage_code = s.cage_code
        ${where}
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY
          (award_velocity + contract_value_growth + agency_diversification + setaside_graduation) DESC
        )                                                                    AS rank,
        cage_code,
        uei,
        name,
        state_code,
        latest_fiscal_year,
        cached_at,
        ROUND((award_velocity + contract_value_growth + agency_diversification + setaside_graduation) / 4, 2) AS composite_score,
        JSON_BUILD_OBJECT(
          'award_velocity',       award_velocity,
          'contract_value_growth', contract_value_growth,
          'agency_diversification', agency_diversification,
          'setaside_graduation',  setaside_graduation
        )                                                                    AS score_breakdown,
        award_count,
        total_obligated_amount                                               AS total_obligated
      FROM scored
      ORDER BY composite_score DESC
      LIMIT $${values.length + 1}
    `, [...values, l]);

    res.json({
      year: year ? parseInt(year, 10) : null,
      data: result.rows,
      cached_at: result.rows[0]?.cached_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/emerging-winners
// Vendors with first-ever award this year OR a significant YoY jump (>100%).
// ---------------------------------------------------------------------------
router.get('/emerging-winners', async (req, res, next) => {
  try {
    const {
      year, min_obligated = '0', state_code, naics_code,
      limit = '25',
    } = req.query;

    const l           = Math.min(50, Math.max(1, parseInt(limit, 10) || 25));
    const minObligated = parseFloat(min_obligated) || 0;
    const conditions  = [`s.cage_code IS NOT NULL`];
    const values      = [];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`s.latest_fiscal_year = $${values.length}`);
    }
    if (state_code) {
      values.push(state_code.toUpperCase());
      conditions.push(`v.state_code = $${values.length}`);
    }
    if (naics_code) {
      values.push(naics_code);
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id AND a.naics_code = $${values.length}
      )`);
    }

    values.push(minObligated);
    conditions.push(`s.total_obligated_amount >= $${values.length}`);

    // First-ever = previous_year_obligated_amount is NULL
    // Breakout = yoy_growth_pct > 100
    conditions.push(`(s.previous_year_obligated_amount IS NULL OR s.yoy_growth_pct > 100)`);

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(`
      SELECT
        s.cage_code,
        s.uei,
        s.company_name                                           AS name,
        v.state_code,
        s.first_award_date,
        s.award_count,
        s.total_obligated_amount                                 AS total_obligated,
        COALESCE(s.previous_year_obligated_amount, 0)            AS prev_year_obligated,
        s.yoy_growth_pct                                         AS growth_pct,
        (s.previous_year_obligated_amount IS NULL)               AS is_first_ever_award,
        s.cached_at
      FROM vendor_investment_summary s
      JOIN vendor_entities v ON v.cage_code = s.cage_code
      ${where}
      ORDER BY s.total_obligated_amount DESC
      LIMIT $${values.length + 1}
    `, [...values, l]);

    res.json({
      year: year ? parseInt(year, 10) : null,
      data: result.rows,
      cached_at: result.rows[0]?.cached_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/risk-profile/:cage_code
// Agency concentration, contract type breakdown, modification health.
// ---------------------------------------------------------------------------
router.get('/risk-profile/:cage_code', async (req, res, next) => {
  try {
    const { cage_code } = req.params;

    const vendorResult = await db.query(
      `SELECT vendor_id, vendor_name FROM vendor_entities WHERE cage_code = $1`,
      [cage_code.toUpperCase()]
    );
    if (!vendorResult.rows.length) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${cage_code} not found` } });
    }

    const { vendor_id, vendor_name } = vendorResult.rows[0];

    const [agencyConc, contractTypes, modHealth, summary] = await Promise.all([
      // Agency concentration
      db.query(`
        SELECT
          contracting_agency_code                                      AS agency_code,
          contracting_agency_name                                      AS agency_name,
          SUM(award_amount)                                            AS obligated,
          ROUND(100.0 * SUM(award_amount)
            / NULLIF(SUM(SUM(award_amount)) OVER (), 0), 2)           AS pct_of_total
        FROM award_transactions
        WHERE vendor_id = $1
        GROUP BY contracting_agency_code, contracting_agency_name
        ORDER BY obligated DESC
      `, [vendor_id]),

      // Contract type breakdown from extra_attributes (award_type_description)
      db.query(`
        SELECT
          award_type_description                                       AS type,
          COUNT(*)                                                     AS count,
          ROUND(100.0 * COUNT(*)
            / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)                    AS pct
        FROM award_transactions
        WHERE vendor_id = $1 AND award_type_description IS NOT NULL
        GROUP BY award_type_description
        ORDER BY count DESC
      `, [vendor_id]),

      // Modification health
      db.query(`
        SELECT
          COUNT(DISTINCT COALESCE(NULLIF(contract_id,''), NULLIF(piid,''), award_key)) AS total_contracts,
          COUNT(*) FILTER (WHERE modification_number IS NOT NULL
            AND modification_number <> '0'
            AND modification_number <> '')                            AS total_modifications,
          COUNT(*) FILTER (WHERE CAST(modification_number AS TEXT) ~ '^\d+$'
            AND modification_number::INTEGER > 5)                     AS high_mod_contracts
        FROM award_transactions
        WHERE vendor_id = $1
      `, [vendor_id]),

      // Cached_at from materialized view
      db.query(
        `SELECT cached_at FROM vendor_investment_summary WHERE cage_code = $1`,
        [cage_code.toUpperCase()]
      ),
    ]);

    const mh = modHealth.rows[0];
    const totalContracts   = parseInt(mh.total_contracts, 10);
    const totalModifications = parseInt(mh.total_modifications, 10);

    res.json({
      cage_code: cage_code.toUpperCase(),
      name: vendor_name,
      agency_concentration: agencyConc.rows,
      contract_type_breakdown: contractTypes.rows,
      modification_health: {
        total_contracts: totalContracts,
        total_modifications: totalModifications,
        avg_modifications_per_contract: totalContracts
          ? parseFloat((totalModifications / totalContracts).toFixed(2))
          : 0,
        high_mod_contracts: parseInt(mh.high_mod_contracts, 10),
      },
      cached_at: summary.rows[0]?.cached_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/sector-heatmap
// Top NAICS sectors by spend with top 5 vendors per sector.
// ---------------------------------------------------------------------------
router.get('/sector-heatmap', async (req, res, next) => {
  try {
    const { year, agency_code, limit = '20' } = req.query;
    const l = Math.min(20, Math.max(1, parseInt(limit, 10) || 20));

    const conditions = [`a.naics_code IS NOT NULL AND BTRIM(a.naics_code) <> ''`];
    const values     = [];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`COALESCE(a.award_fiscal_year, a.contract_fiscal_year) = $${values.length}`);
    }
    if (agency_code) {
      values.push(agency_code);
      conditions.push(`a.contracting_agency_code = $${values.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Get top sectors
    const sectorsResult = await db.query(`
      SELECT
        a.naics_code,
        COALESCE(n.description, a.naics_description) AS naics_name,
        COUNT(*)                                      AS award_count,
        SUM(a.award_amount)                           AS total_obligated
      FROM award_transactions a
      LEFT JOIN naics_codes n ON n.code = a.naics_code
      ${where}
      GROUP BY a.naics_code, naics_name
      ORDER BY total_obligated DESC
      LIMIT $${values.length + 1}
    `, [...values, l]);

    // For each sector get top 5 vendors
    const sectorCodes = sectorsResult.rows.map(r => r.naics_code);

    const vendorConditions = [...conditions];
    let nextParam = values.length + 1;
    vendorConditions.push(`a.naics_code = ANY($${nextParam})`);
    const vendorValues = [...values, sectorCodes];
    nextParam++;

    const vendorsResult = await db.query(`
      SELECT
        a.naics_code,
        v.cage_code,
        v.vendor_name                                 AS name,
        SUM(a.award_amount)                           AS total_obligated,
        ROUND(100.0 * SUM(a.award_amount)
          / NULLIF(SUM(SUM(a.award_amount)) OVER (PARTITION BY a.naics_code), 0), 2) AS market_share_pct,
        ROW_NUMBER() OVER (PARTITION BY a.naics_code ORDER BY SUM(a.award_amount) DESC) AS rn
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE ${vendorConditions.join(' AND ')}
        AND v.cage_code IS NOT NULL AND BTRIM(v.cage_code) <> ''
      GROUP BY a.naics_code, v.cage_code, v.vendor_name
    `, vendorValues);

    // Group top vendors per sector (top 5 only)
    const vendorsBySector = {};
    for (const row of vendorsResult.rows) {
      if (row.rn <= 5) {
        if (!vendorsBySector[row.naics_code]) vendorsBySector[row.naics_code] = [];
        vendorsBySector[row.naics_code].push({
          cage_code: row.cage_code,
          name: row.name,
          total_obligated: row.total_obligated,
          market_share_pct: row.market_share_pct,
        });
      }
    }

    const data = sectorsResult.rows.map(s => ({
      naics_code: s.naics_code,
      naics_name: s.naics_name,
      award_count: parseInt(s.award_count, 10),
      total_obligated: s.total_obligated,
      top_vendors: vendorsBySector[s.naics_code] || [],
    }));

    res.json({ year: year ? parseInt(year, 10) : null, data, cached_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/win-rate/:cage_code
// Competitive win rate and set-aside history per vendor.
// ---------------------------------------------------------------------------
router.get('/win-rate/:cage_code', async (req, res, next) => {
  try {
    const { cage_code } = req.params;
    const { year } = req.query;

    const vendorResult = await db.query(
      `SELECT vendor_id, vendor_name FROM vendor_entities WHERE cage_code = $1`,
      [cage_code.toUpperCase()]
    );
    if (!vendorResult.rows.length) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${cage_code} not found` } });
    }

    const { vendor_id, vendor_name } = vendorResult.rows[0];

    const conditions = [`vendor_id = $1`];
    const values     = [vendor_id];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`COALESCE(award_fiscal_year, contract_fiscal_year) = $${values.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [winRateResult, setasideResult, summaryResult] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                                  AS total_awards,
          COUNT(*) FILTER (WHERE extent_competed_code IN ('A','B','C','D','E','F')) AS competed_awards,
          COUNT(*) FILTER (WHERE extent_competed_code IN ('G','H','CDO'))           AS sole_source_awards,
          ROUND(AVG(
            CASE WHEN (extra_attributes->>'number_of_offers_received') ~ '^\d+$'
              THEN (extra_attributes->>'number_of_offers_received')::NUMERIC
            END
          ), 2)                                                     AS avg_offers_received
        FROM award_transactions
        ${where}
      `, values),

      // Set-aside history by year
      db.query(`
        SELECT
          COALESCE(award_fiscal_year, contract_fiscal_year)         AS fiscal_year,
          set_aside_code                                            AS type,
          set_aside_name                                            AS label
        FROM award_transactions
        WHERE vendor_id = $1
          AND set_aside_code IS NOT NULL AND BTRIM(set_aside_code) <> ''
        GROUP BY fiscal_year, set_aside_code, set_aside_name
        ORDER BY fiscal_year ASC
      `, [vendor_id]),

      db.query(
        `SELECT cached_at FROM vendor_investment_summary WHERE cage_code = $1`,
        [cage_code.toUpperCase()]
      ),
    ]);

    const wr = winRateResult.rows[0];
    const totalAwards    = parseInt(wr.total_awards, 10);
    const competedAwards = parseInt(wr.competed_awards, 10);

    // Detect set-aside graduation: had SBA/small-biz set-aside previously, now has NONE
    const history = setasideResult.rows;
    const hadSetAside = history.some(r => r.type && r.type !== 'NONE');
    const latestSetAside = history[history.length - 1]?.type;
    const graduated = hadSetAside && (latestSetAside === 'NONE' || latestSetAside === 'NO SET ASIDE USED');

    res.json({
      cage_code: cage_code.toUpperCase(),
      name: vendor_name,
      year: year ? parseInt(year, 10) : null,
      total_awards: totalAwards,
      competed_awards: competedAwards,
      sole_source_awards: parseInt(wr.sole_source_awards, 10),
      competitive_win_rate_pct: totalAwards
        ? parseFloat(((competedAwards / totalAwards) * 100).toFixed(2))
        : 0,
      avg_offers_received: wr.avg_offers_received,
      setaside_history: history,
      graduated_from_setaside: graduated,
      cached_at: summaryResult.rows[0]?.cached_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/geographic-clustering
// Dominant vendors by state with regional market share.
// ---------------------------------------------------------------------------
router.get('/geographic-clustering', async (req, res, next) => {
  try {
    const { year, state_code, naics_code, limit = '5' } = req.query;
    const vendorsPerRegion = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));

    const conditions = [
      `a.place_of_performance_state_code IS NOT NULL`,
      `BTRIM(a.place_of_performance_state_code) <> ''`,
    ];
    const values = [];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`COALESCE(a.award_fiscal_year, a.contract_fiscal_year) = $${values.length}`);
    }
    if (state_code) {
      values.push(state_code.toUpperCase());
      conditions.push(`a.place_of_performance_state_code = $${values.length}`);
    }
    if (naics_code) {
      values.push(naics_code);
      conditions.push(`a.naics_code = $${values.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // State totals
    const statesResult = await db.query(`
      SELECT
        a.place_of_performance_state_code                           AS state_code,
        a.place_of_performance_state_name                          AS state_name,
        COUNT(*)                                                    AS award_count,
        SUM(a.award_amount)                                        AS total_obligated,
        ROUND(100.0 * SUM(a.award_amount)
          / NULLIF(SUM(SUM(a.award_amount)) OVER (), 0), 2)        AS pct_of_national_total
      FROM award_transactions a
      ${where}
      GROUP BY a.place_of_performance_state_code, a.place_of_performance_state_name
      ORDER BY total_obligated DESC
    `, values);

    if (!statesResult.rows.length) {
      return res.json({ year: year ? parseInt(year, 10) : null, data: [], cached_at: new Date().toISOString() });
    }

    const stateCodes = statesResult.rows.map(r => r.state_code);

    // Top vendors per state
    const vendorConditions = [...conditions, `a.place_of_performance_state_code = ANY($${values.length + 1})`];
    const vendorsResult = await db.query(`
      SELECT
        a.place_of_performance_state_code                           AS state_code,
        v.cage_code,
        v.vendor_name                                               AS name,
        SUM(a.award_amount)                                        AS total_obligated,
        ROUND(100.0 * SUM(a.award_amount)
          / NULLIF(SUM(SUM(a.award_amount)) OVER (
            PARTITION BY a.place_of_performance_state_code
          ), 0), 2)                                                AS regional_market_share_pct,
        ROW_NUMBER() OVER (
          PARTITION BY a.place_of_performance_state_code
          ORDER BY SUM(a.award_amount) DESC
        )                                                           AS rn
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE ${vendorConditions.join(' AND ')}
        AND v.cage_code IS NOT NULL AND BTRIM(v.cage_code) <> ''
      GROUP BY a.place_of_performance_state_code, v.cage_code, v.vendor_name
    `, [...values, stateCodes]);

    const vendorsByState = {};
    for (const row of vendorsResult.rows) {
      if (row.rn <= vendorsPerRegion) {
        if (!vendorsByState[row.state_code]) vendorsByState[row.state_code] = [];
        vendorsByState[row.state_code].push({
          cage_code: row.cage_code,
          name: row.name,
          total_obligated: row.total_obligated,
          regional_market_share_pct: row.regional_market_share_pct,
        });
      }
    }

    const data = statesResult.rows.map(s => ({
      state_code: s.state_code,
      state_name: s.state_name,
      award_count: parseInt(s.award_count, 10),
      total_obligated: s.total_obligated,
      pct_of_national_total: s.pct_of_national_total,
      top_vendors: vendorsByState[s.state_code] || [],
    }));

    res.json({ year: year ? parseInt(year, 10) : null, data, cached_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
