const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

// ---------------------------------------------------------------------------
// GET /api/analytics/kpi
// Dashboard headline numbers: total obligated, award count, vendor count,
// sole-source rate.
// ---------------------------------------------------------------------------
router.get('/kpi', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(a.award_amount)                                               AS "totalObligated",
        COUNT(*)                                                          AS "totalAwards",
        COUNT(DISTINCT a.vendor_id)                                       AS "totalVendors",
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE a.extent_competed_code IN ('G','H','CDO'))
          / NULLIF(COUNT(*), 0),
        2)                                                                AS "soleSourcePct"
      FROM award_transactions a
    `);

    const row = result.rows[0];
    res.json({
      totalObligated: parseFloat(row.totalObligated) || 0,
      totalAwards:    parseInt(row.totalAwards, 10) || 0,
      totalVendors:   parseInt(row.totalVendors, 10) || 0,
      soleSourcePct:  parseFloat(row.soleSourcePct) || 0,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/investment-scores
// ---------------------------------------------------------------------------
router.get('/investment-scores', async (req, res, next) => {
  try {
    const { year, state_code, naics_code, limit = '25' } = req.query;

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
      values.push(naics_code);
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id AND a.naics_code = $${values.length}
      )`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(`
      WITH scored AS (
        SELECT
          s.cage_code,
          s.uei,
          s.company_name                                                      AS name,
          v.state_code                                                        AS "stateCode",
          s.latest_fiscal_year                                                AS "latestFiscalYear",
          s.cached_at                                                         AS "cachedAt",
          s.award_count                                                       AS "awardCount",
          s.total_obligated_amount                                            AS "totalObligated",
          s.yoy_growth_pct,
          s.distinct_contracting_agencies,
          ROUND(100.0 * s.award_count
            / NULLIF(MAX(s.award_count) OVER (), 0), 2)                      AS "awardVelocity",
          ROUND(LEAST(GREATEST(COALESCE(s.yoy_growth_pct, 0), 0), 100), 2)  AS "contractValueGrowth",
          ROUND(100.0 * s.distinct_contracting_agencies
            / NULLIF(MAX(s.distinct_contracting_agencies) OVER (), 0), 2)    AS "agencyDiversification",
          ROUND(100.0 * s.total_obligated_amount
            / NULLIF(MAX(s.total_obligated_amount) OVER (), 0), 2)           AS "setasideGraduation"
        FROM vendor_investment_summary s
        JOIN vendor_entities v ON v.cage_code = s.cage_code
        ${where}
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY
          ("awardVelocity" + "contractValueGrowth" + "agencyDiversification" + "setasideGraduation") DESC
        )                                                                     AS rank,
        cage_code                                                             AS "cageCode",
        uei,
        name,
        "stateCode",
        "latestFiscalYear",
        "cachedAt",
        ROUND(("awardVelocity" + "contractValueGrowth" + "agencyDiversification" + "setasideGraduation") / 4, 2) AS "compositeScore",
        JSON_BUILD_OBJECT(
          'awardVelocity',        "awardVelocity",
          'contractValueGrowth',  "contractValueGrowth",
          'agencyDiversification',"agencyDiversification",
          'setasideGraduation',   "setasideGraduation"
        )                                                                     AS "scoreBreakdown",
        "awardCount",
        "totalObligated"
      FROM scored
      ORDER BY "compositeScore" DESC
      LIMIT $${values.length + 1}
    `, [...values, l]);

    res.json({
      year: year ? parseInt(year, 10) : null,
      data: result.rows,
      cachedAt: result.rows[0]?.cachedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/emerging-winners
// ---------------------------------------------------------------------------
router.get('/emerging-winners', async (req, res, next) => {
  try {
    const {
      year, min_obligated = '0', state_code, naics_code,
      limit = '25',
    } = req.query;

    const l            = Math.min(50, Math.max(1, parseInt(limit, 10) || 25));
    const minObligated = parseFloat(min_obligated) || 0;
    const conditions   = [`s.cage_code IS NOT NULL`];
    const values       = [];

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
    conditions.push(`(s.previous_year_obligated_amount IS NULL OR s.yoy_growth_pct > 100)`);

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(`
      SELECT
        s.cage_code                                             AS "cageCode",
        s.uei,
        s.company_name                                          AS name,
        v.state_code                                            AS "stateCode",
        s.first_award_date                                      AS "firstAwardDate",
        s.award_count                                           AS "awardCount",
        s.total_obligated_amount                                AS "totalObligated",
        COALESCE(s.previous_year_obligated_amount, 0)           AS "prevYearObligated",
        s.yoy_growth_pct                                        AS "growthPct",
        (s.previous_year_obligated_amount IS NULL)              AS "isFirstEverAward",
        s.cached_at                                             AS "cachedAt"
      FROM vendor_investment_summary s
      JOIN vendor_entities v ON v.cage_code = s.cage_code
      ${where}
      ORDER BY s.total_obligated_amount DESC
      LIMIT $${values.length + 1}
    `, [...values, l]);

    res.json({
      year: year ? parseInt(year, 10) : null,
      data: result.rows,
      cachedAt: result.rows[0]?.cachedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/risk-profile/:cage_code
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
      db.query(`
        SELECT
          contracting_agency_code                               AS "agencyCode",
          contracting_agency_name                               AS "agencyName",
          SUM(award_amount)                                     AS obligated,
          ROUND(100.0 * SUM(award_amount)
            / NULLIF(SUM(SUM(award_amount)) OVER (), 0), 2)    AS "pctOfTotal"
        FROM award_transactions
        WHERE vendor_id = $1
        GROUP BY contracting_agency_code, contracting_agency_name
        ORDER BY obligated DESC
      `, [vendor_id]),

      db.query(`
        SELECT
          award_type_description                                AS type,
          COUNT(*)                                              AS count,
          ROUND(100.0 * COUNT(*)
            / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)             AS pct
        FROM award_transactions
        WHERE vendor_id = $1 AND award_type_description IS NOT NULL
        GROUP BY award_type_description
        ORDER BY count DESC
      `, [vendor_id]),

      db.query(`
        SELECT
          COUNT(DISTINCT COALESCE(NULLIF(contract_id,''), NULLIF(piid,''), award_key)) AS "totalContracts",
          COUNT(*) FILTER (WHERE modification_number IS NOT NULL
            AND modification_number <> '0'
            AND modification_number <> '')                      AS "totalModifications",
          COUNT(*) FILTER (WHERE CAST(modification_number AS TEXT) ~ '^\d+$'
            AND modification_number::INTEGER > 5)               AS "highModContracts"
        FROM award_transactions
        WHERE vendor_id = $1
      `, [vendor_id]),

      db.query(
        `SELECT cached_at FROM vendor_investment_summary WHERE cage_code = $1`,
        [cage_code.toUpperCase()]
      ),
    ]);

    const mh = modHealth.rows[0];
    const totalContracts      = parseInt(mh.totalContracts, 10);
    const totalModifications  = parseInt(mh.totalModifications, 10);

    res.json({
      cageCode: cage_code.toUpperCase(),
      name:     vendor_name,
      agencyConcentration:    agencyConc.rows,
      contractTypeBreakdown:  contractTypes.rows,
      modificationHealth: {
        totalContracts,
        totalModifications,
        avgModificationsPerContract: totalContracts
          ? parseFloat((totalModifications / totalContracts).toFixed(2))
          : 0,
        highModContracts: parseInt(mh.highModContracts, 10),
      },
      cachedAt: summary.rows[0]?.cached_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/sector-heatmap
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

    const sectorsResult = await db.query(`
      SELECT
        a.naics_code                                            AS "naicsCode",
        COALESCE(n.description, a.naics_description)           AS "naicsName",
        COUNT(*)                                               AS "awardCount",
        SUM(a.award_amount)                                    AS "totalObligated"
      FROM award_transactions a
      LEFT JOIN naics_codes n ON n.code = a.naics_code
      ${where}
      GROUP BY a.naics_code, "naicsName"
      ORDER BY "totalObligated" DESC
      LIMIT $${values.length + 1}
    `, [...values, l]);

    const sectorCodes = sectorsResult.rows.map((r) => r.naicsCode);

    const vendorConditions = [...conditions];
    let nextParam = values.length + 1;
    vendorConditions.push(`a.naics_code = ANY($${nextParam})`);
    const vendorValues = [...values, sectorCodes];

    const vendorsResult = await db.query(`
      SELECT
        a.naics_code                                            AS "naicsCode",
        v.cage_code                                             AS "cageCode",
        v.vendor_name                                           AS name,
        SUM(a.award_amount)                                     AS "totalObligated",
        ROUND(100.0 * SUM(a.award_amount)
          / NULLIF(SUM(SUM(a.award_amount)) OVER (PARTITION BY a.naics_code), 0), 2) AS "marketSharePct",
        ROW_NUMBER() OVER (PARTITION BY a.naics_code ORDER BY SUM(a.award_amount) DESC) AS rn
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE ${vendorConditions.join(' AND ')}
      GROUP BY a.naics_code, v.cage_code, v.vendor_name
    `, vendorValues);

    const vendorsBySector = {};
    for (const row of vendorsResult.rows) {
      if (row.rn <= 5) {
        if (!vendorsBySector[row.naicsCode]) vendorsBySector[row.naicsCode] = [];
        vendorsBySector[row.naicsCode].push({
          cageCode:       row.cageCode,
          name:           row.name,
          totalObligated: row.totalObligated,
          marketSharePct: row.marketSharePct,
        });
      }
    }

    const data = sectorsResult.rows.map((s) => ({
      naicsCode:      s.naicsCode,
      naicsName:      s.naicsName,
      awardCount:     parseInt(s.awardCount, 10),
      totalObligated: s.totalObligated,
      topVendors:     vendorsBySector[s.naicsCode] || [],
    }));

    res.json({ year: year ? parseInt(year, 10) : null, data, cachedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/win-rate/:cage_code
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
          COUNT(*)                                                    AS "totalAwards",
          COUNT(*) FILTER (WHERE extent_competed_code IN ('A','B','C','D','E','F')) AS "competedAwards",
          COUNT(*) FILTER (WHERE extent_competed_code IN ('G','H','CDO'))           AS "soleSourceAwards",
          ROUND(AVG(
            CASE WHEN (extra_attributes->>'number_of_offers_received') ~ '^\d+$'
              THEN (extra_attributes->>'number_of_offers_received')::NUMERIC
            END
          ), 2)                                                       AS "avgOffersReceived"
        FROM award_transactions
        ${where}
      `, values),

      db.query(`
        SELECT
          COALESCE(award_fiscal_year, contract_fiscal_year)           AS "fiscalYear",
          set_aside_code                                              AS type,
          set_aside_name                                              AS label
        FROM award_transactions
        WHERE vendor_id = $1
          AND set_aside_code IS NOT NULL AND BTRIM(set_aside_code) <> ''
        GROUP BY "fiscalYear", set_aside_code, set_aside_name
        ORDER BY "fiscalYear" ASC
      `, [vendor_id]),

      db.query(
        `SELECT cached_at FROM vendor_investment_summary WHERE cage_code = $1`,
        [cage_code.toUpperCase()]
      ),
    ]);

    const wr = winRateResult.rows[0];
    const totalAwards    = parseInt(wr.totalAwards, 10);
    const competedAwards = parseInt(wr.competedAwards, 10);

    const history = setasideResult.rows;
    const hadSetAside    = history.some((r) => r.type && r.type !== 'NONE');
    const latestSetAside = history[history.length - 1]?.type;
    const graduated      = hadSetAside && (latestSetAside === 'NONE' || latestSetAside === 'NO SET ASIDE USED');

    res.json({
      cageCode:              cage_code.toUpperCase(),
      name:                  vendor_name,
      year:                  year ? parseInt(year, 10) : null,
      totalAwards,
      competedAwards,
      soleSourceAwards:      parseInt(wr.soleSourceAwards, 10),
      competitiveWinRatePct: totalAwards
        ? parseFloat(((competedAwards / totalAwards) * 100).toFixed(2))
        : 0,
      avgOffersReceived:     wr.avgOffersReceived,
      setasideHistory:       history,
      graduatedFromSetaside: graduated,
      cachedAt:              summaryResult.rows[0]?.cached_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/geographic-clustering
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

    const statesResult = await db.query(`
      SELECT
        a.place_of_performance_state_code                     AS "stateCode",
        a.place_of_performance_state_name                     AS "stateName",
        COUNT(*)                                              AS "awardCount",
        SUM(a.award_amount)                                   AS "totalObligated",
        ROUND(100.0 * SUM(a.award_amount)
          / NULLIF(SUM(SUM(a.award_amount)) OVER (), 0), 2)  AS "pctOfNationalTotal"
      FROM award_transactions a
      ${where}
      GROUP BY a.place_of_performance_state_code, a.place_of_performance_state_name
      ORDER BY "totalObligated" DESC
    `, values);

    if (!statesResult.rows.length) {
      return res.json({ year: year ? parseInt(year, 10) : null, data: [], cachedAt: new Date().toISOString() });
    }

    const stateCodes = statesResult.rows.map((r) => r.stateCode);

    const vendorConditions = [...conditions, `a.place_of_performance_state_code = ANY($${values.length + 1})`];
    const vendorsResult = await db.query(`
      SELECT
        a.place_of_performance_state_code                     AS "stateCode",
        v.cage_code                                           AS "cageCode",
        v.vendor_name                                         AS name,
        SUM(a.award_amount)                                   AS "totalObligated",
        ROUND(100.0 * SUM(a.award_amount)
          / NULLIF(SUM(SUM(a.award_amount)) OVER (
            PARTITION BY a.place_of_performance_state_code
          ), 0), 2)                                           AS "regionalMarketSharePct",
        ROW_NUMBER() OVER (
          PARTITION BY a.place_of_performance_state_code
          ORDER BY SUM(a.award_amount) DESC
        )                                                     AS rn
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE ${vendorConditions.join(' AND ')}
      GROUP BY a.place_of_performance_state_code, v.cage_code, v.vendor_name
    `, [...values, stateCodes]);

    const vendorsByState = {};
    for (const row of vendorsResult.rows) {
      if (row.rn <= vendorsPerRegion) {
        if (!vendorsByState[row.stateCode]) vendorsByState[row.stateCode] = [];
        vendorsByState[row.stateCode].push({
          cageCode:               row.cageCode,
          name:                   row.name,
          totalObligated:         row.totalObligated,
          regionalMarketSharePct: row.regionalMarketSharePct,
        });
      }
    }

    const data = statesResult.rows.map((s) => ({
      stateCode:          s.stateCode,
      stateName:          s.stateName,
      awardCount:         parseInt(s.awardCount, 10),
      totalObligated:     s.totalObligated,
      pctOfNationalTotal: s.pctOfNationalTotal,
      topVendors:         vendorsByState[s.stateCode] || [],
    }));

    res.json({ year: year ? parseInt(year, 10) : null, data, cachedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
