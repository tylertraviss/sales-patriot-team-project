const express = require('express');

const router = express.Router();
const db = require('../db/connection');

const COMPETED_CODES = ['A', 'B', 'C', 'D', 'E', 'F'];
const SOLE_SOURCE_CODES = ['G', 'H', 'CDO'];

function parseLimit(value, { fallback = 25, min = 1, max = 50 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeCode(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

function fiscalYearExpr(alias = 'a') {
  return `COALESCE(${alias}.award_fiscal_year, ${alias}.contract_fiscal_year, EXTRACT(YEAR FROM COALESCE(${alias}.award_date, ${alias}.date_signed, ${alias}.reveal_date))::INT)`;
}

function competitionBucketExpr(alias = 'a') {
  const competed = COMPETED_CODES.map((code) => `'${code}'`).join(', ');
  const soleSource = SOLE_SOURCE_CODES.map((code) => `'${code}'`).join(', ');

  return `
    CASE
      WHEN ${alias}.extent_competed_code IN (${competed}) THEN 'competed'
      WHEN ${alias}.extent_competed_code IN (${soleSource}) THEN 'sole_source'
      ELSE 'unknown'
    END
  `;
}

function buildAwardFilters(query, { alias = 'a', values = [] } = {}) {
  const conditions = [];

  if (query.year) {
    values.push(Number.parseInt(query.year, 10));
    conditions.push(`${fiscalYearExpr(alias)} = $${values.length}`);
  }

  if (query.agency_code) {
    values.push(normalizeCode(query.agency_code));
    conditions.push(`${alias}.contracting_agency_code = $${values.length}`);
  }

  if (query.naics_code) {
    values.push(normalizeCode(query.naics_code));
    conditions.push(`${alias}.naics_code = $${values.length}`);
  }

  if (query.state_code) {
    values.push(normalizeCode(query.state_code));
    conditions.push(`${alias}.place_of_performance_state_code = $${values.length}`);
  }

  if (query.set_aside_code) {
    values.push(normalizeCode(query.set_aside_code));
    conditions.push(`${alias}.set_aside_code = $${values.length}`);
  }

  if (query.competition_bucket) {
    values.push(String(query.competition_bucket).trim().toLowerCase());
    conditions.push(`${competitionBucketExpr(alias)} = $${values.length}`);
  }

  return { conditions, values };
}

function buildVendorExistenceClause(query, { vendorAlias = 'v', values = [] } = {}) {
  const parts = buildAwardFilters(query, { alias: 'a', values });
  const conditions = [`a.vendor_id = ${vendorAlias}.vendor_id`, ...parts.conditions];

  return {
    clause: `EXISTS (SELECT 1 FROM award_transactions a WHERE ${conditions.join(' AND ')})`,
    values: parts.values,
  };
}

async function findVendorByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) {
    return null;
  }

  const result = await db.query(
    `SELECT
       vendor_id AS "vendorId",
       cage_code AS "cageCode",
       uei,
       vendor_name AS name
     FROM vendor_entities
     WHERE vendor_id::text = $1
        OR cage_code = $2
        OR uei = $2
     LIMIT 1`,
    [raw, raw.toUpperCase()],
  );

  return result.rows[0] || null;
}

async function buildRiskProfile(vendorId, query) {
  const values = [vendorId];
  const parts = buildAwardFilters(query, { alias: 'a', values });
  const where = `WHERE a.vendor_id = $1${parts.conditions.length ? ` AND ${parts.conditions.join(' AND ')}` : ''}`;

  const [vendorResult, agencyResult, concentrationResult, contractTypeResult] = await Promise.all([
    db.query(
      `SELECT vendor_id AS "vendorId", cage_code AS "cageCode", uei, vendor_name AS name
       FROM vendor_entities
       WHERE vendor_id = $1`,
      [vendorId],
    ),
    db.query(
      `WITH grouped AS (
         SELECT
           a.contracting_agency_code AS "agencyCode",
           COALESCE(MAX(a.contracting_agency_name), a.contracting_agency_code) AS "agencyName",
           SUM(COALESCE(a.award_amount, 0)) AS obligated
         FROM award_transactions a
         ${where}
         AND a.contracting_agency_code IS NOT NULL
         AND BTRIM(a.contracting_agency_code) <> ''
         GROUP BY a.contracting_agency_code
       )
       SELECT
         "agencyCode",
         "agencyName",
         obligated AS "totalObligated",
         ROUND(100.0 * obligated / NULLIF(SUM(obligated) OVER (), 0), 2) AS "sharePct"
       FROM grouped
       ORDER BY obligated DESC
       LIMIT 8`,
      values,
    ),
    db.query(
      `WITH grouped AS (
         SELECT
           a.contracting_agency_code,
           SUM(COALESCE(a.award_amount, 0)) AS obligated
         FROM award_transactions a
         ${where}
         AND a.contracting_agency_code IS NOT NULL
         AND BTRIM(a.contracting_agency_code) <> ''
         GROUP BY a.contracting_agency_code
       ),
       shares AS (
         SELECT obligated / NULLIF(SUM(obligated) OVER (), 0) AS share_fraction
         FROM grouped
       )
       SELECT
         ROUND(100.0 * MAX(share_fraction), 2) AS "topAgencySharePct",
         ROUND(SUM(POWER(share_fraction, 2)) * 10000, 0) AS "concentrationScore"
       FROM shares`,
      values,
    ),
    db.query(
      `SELECT
         COALESCE(NULLIF(a.award_type_description, ''), 'Unknown') AS "awardType",
         SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
         COUNT(*)::INT AS "awardCount"
       FROM award_transactions a
       ${where}
       GROUP BY COALESCE(NULLIF(a.award_type_description, ''), 'Unknown')
       ORDER BY "totalObligated" DESC
       LIMIT 8`,
      values,
    ),
  ]);

  if (!vendorResult.rows.length) {
    return null;
  }

  const vendor = vendorResult.rows[0];
  const concentration = concentrationResult.rows[0] || {};

  return {
    vendorId: vendor.vendorId,
    cageCode: vendor.cageCode,
    uei: vendor.uei,
    name: vendor.name,
    topAgencies: agencyResult.rows,
    topAgencySharePct: Number(concentration.topAgencySharePct || 0),
    concentrationScore: Number(concentration.concentrationScore || 0),
    contractTypeBreakdown: contractTypeResult.rows,
  };
}

router.get('/kpi', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
        COUNT(*)::INT AS "totalAwards",
        COUNT(DISTINCT a.vendor_id)::INT AS "totalVendors",
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source')
          / NULLIF(COUNT(*), 0),
          2
        ) AS "soleSourcePct"
      FROM award_transactions a
    `);

    const row = result.rows[0] || {};
    res.json({
      totalObligated: Number(row.totalObligated || 0),
      totalAwards: Number(row.totalAwards || 0),
      totalVendors: Number(row.totalVendors || 0),
      soleSourcePct: Number(row.soleSourcePct || 0),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/filters', async (_req, res, next) => {
  try {
    const [years, agencies, naics, states, setAsides] = await Promise.all([
      db.query(`
        SELECT DISTINCT ${fiscalYearExpr('a')} AS "fiscalYear"
        FROM award_transactions a
        WHERE ${fiscalYearExpr('a')} IS NOT NULL
        ORDER BY "fiscalYear" DESC
      `),
      db.query(`
        SELECT
          a.contracting_agency_code AS code,
          COALESCE(MAX(a.contracting_agency_name), a.contracting_agency_code) AS name
        FROM award_transactions a
        WHERE a.contracting_agency_code IS NOT NULL
          AND BTRIM(a.contracting_agency_code) <> ''
        GROUP BY a.contracting_agency_code
        ORDER BY name ASC
      `),
      db.query(`
        SELECT
          a.naics_code AS code,
          COALESCE(MAX(n.description), MAX(a.naics_description), a.naics_code) AS name
        FROM award_transactions a
        LEFT JOIN naics_codes n ON n.code = a.naics_code
        WHERE a.naics_code IS NOT NULL
          AND BTRIM(a.naics_code) <> ''
        GROUP BY a.naics_code
        ORDER BY name ASC
      `),
      db.query(`
        SELECT
          a.place_of_performance_state_code AS code,
          COALESCE(MAX(a.place_of_performance_state_name), a.place_of_performance_state_code) AS name
        FROM award_transactions a
        WHERE a.place_of_performance_state_code IS NOT NULL
          AND BTRIM(a.place_of_performance_state_code) <> ''
        GROUP BY a.place_of_performance_state_code
        ORDER BY name ASC
      `),
      db.query(`
        SELECT
          a.set_aside_code AS code,
          COALESCE(MAX(a.set_aside_name), a.set_aside_code) AS name
        FROM award_transactions a
        WHERE a.set_aside_code IS NOT NULL
          AND BTRIM(a.set_aside_code) <> ''
        GROUP BY a.set_aside_code
        ORDER BY name ASC
      `),
    ]);

    res.json({
      years: years.rows.map((row) => row.fiscalYear),
      agencies: agencies.rows,
      naics: naics.rows,
      states: states.rows,
      setAsideCodes: setAsides.rows,
      competitionBuckets: [
        { code: 'competed', name: 'Competed' },
        { code: 'sole_source', name: 'Sole Source' },
        { code: 'unknown', name: 'Unknown' },
      ],
    });
  } catch (error) {
    next(error);
  }
});

router.get('/opportunity-heatmap', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, { fallback: 36, max: 100 });
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = [
      `a.contracting_agency_code IS NOT NULL`,
      `BTRIM(a.contracting_agency_code) <> ''`,
      `a.naics_code IS NOT NULL`,
      `BTRIM(a.naics_code) <> ''`,
      ...parts.conditions,
    ];
    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(
      `WITH grouped AS (
         SELECT
           a.contracting_agency_code AS "agencyCode",
           COALESCE(MAX(a.contracting_agency_name), a.contracting_agency_code) AS "agencyName",
           a.naics_code AS "naicsCode",
           COALESCE(MAX(n.description), MAX(a.naics_description), a.naics_code) AS "naicsName",
           COUNT(*)::INT AS "awardCount",
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
           ROUND(100.0 * COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'competed') / NULLIF(COUNT(*), 0), 2) AS "competedSharePct",
           ROUND(100.0 * COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source') / NULLIF(COUNT(*), 0), 2) AS "soleSourceSharePct",
           ROUND(100.0 * COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'unknown') / NULLIF(COUNT(*), 0), 2) AS "unknownCompetitionSharePct"
         FROM award_transactions a
         LEFT JOIN naics_codes n ON n.code = a.naics_code
         ${where}
         GROUP BY a.contracting_agency_code, a.naics_code
       ),
       ranked_vendors AS (
         SELECT
           a.contracting_agency_code AS "agencyCode",
           a.naics_code AS "naicsCode",
           v.vendor_id AS "vendorId",
           v.cage_code AS "cageCode",
           v.uei,
           v.vendor_name AS name,
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
           ROW_NUMBER() OVER (
             PARTITION BY a.contracting_agency_code, a.naics_code
             ORDER BY SUM(COALESCE(a.award_amount, 0)) DESC, v.vendor_name ASC
           ) AS rn
         FROM award_transactions a
         JOIN vendor_entities v ON v.vendor_id = a.vendor_id
         ${where}
         GROUP BY a.contracting_agency_code, a.naics_code, v.vendor_id, v.cage_code, v.uei, v.vendor_name
       )
       SELECT
         g.*,
         jsonb_build_object(
           'vendorId', rv."vendorId",
           'cageCode', rv."cageCode",
           'uei', rv.uei,
           'name', rv.name,
           'totalObligated', rv."totalObligated"
         ) AS "topVendor"
       FROM grouped g
       LEFT JOIN ranked_vendors rv
         ON rv."agencyCode" = g."agencyCode"
        AND rv."naicsCode" = g."naicsCode"
        AND rv.rn = 1
       ORDER BY g."totalObligated" DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    res.json({
      data: result.rows,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/investment-scores', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, { fallback: 25, max: 50 });
    const values = [];
    const existence = buildVendorExistenceClause(req.query, { vendorAlias: 'v', values });
    const conditions = [existence.clause];

    if (req.query.year) {
      values.push(Number.parseInt(req.query.year, 10));
      conditions.push(`s.latest_fiscal_year = $${values.length}`);
    }

    if (req.query.min_obligated) {
      values.push(Number.parseFloat(req.query.min_obligated) || 0);
      conditions.push(`COALESCE(s.total_obligated_amount, 0) >= $${values.length}`);
    }

    const result = await db.query(
      `WITH active_years AS (
         SELECT vendor_id, COUNT(*)::INT AS active_years
         FROM vendor_year_metrics
         GROUP BY vendor_id
       ),
       scored AS (
         SELECT
           s.vendor_id AS "vendorId",
           s.cage_code AS "cageCode",
           s.uei,
           s.company_name AS name,
           COALESCE(v.state_code, '') AS "stateCode",
           s.latest_fiscal_year AS "latestFiscalYear",
           s.cached_at AS "cachedAt",
           COALESCE(s.award_count, 0) AS "awardCount",
           COALESCE(s.total_obligated_amount, 0) AS "totalObligated",
           COALESCE(ay.active_years, 0) AS "activeYears",
           ROUND(LEAST(GREATEST(COALESCE(s.yoy_growth_pct, 0), 0), 200), 2) AS "growthScore",
           ROUND(100.0 * COALESCE(s.distinct_contracting_agencies, 0) / NULLIF(MAX(COALESCE(s.distinct_contracting_agencies, 0)) OVER (), 0), 2) AS "agencyDiversification",
           ROUND(100.0 * COALESCE(s.total_obligated_amount, 0) / NULLIF(MAX(COALESCE(s.total_obligated_amount, 0)) OVER (), 0), 2) AS "scaleScore",
           ROUND(100.0 * COALESCE(ay.active_years, 0) / NULLIF(MAX(COALESCE(ay.active_years, 0)) OVER (), 0), 2) AS "durabilityScore"
         FROM vendor_investment_summary s
         JOIN vendor_entities v ON v.vendor_id = s.vendor_id
         LEFT JOIN active_years ay ON ay.vendor_id = s.vendor_id
         WHERE ${conditions.join(' AND ')}
       )
       SELECT
         ROW_NUMBER() OVER (
           ORDER BY ("growthScore" + "agencyDiversification" + "scaleScore" + "durabilityScore") DESC
         ) AS rank,
         *,
         ROUND(("growthScore" + "agencyDiversification" + "scaleScore" + "durabilityScore") / 4.0, 2) AS "compositeScore",
         json_build_object(
           'growth', "growthScore",
           'agencyDiversification', "agencyDiversification",
           'scale', "scaleScore",
           'durability', "durabilityScore"
         ) AS "scoreBreakdown"
       FROM scored
       ORDER BY "compositeScore" DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    res.json({
      data: result.rows,
      cachedAt: result.rows[0]?.cachedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/emerging-winners', async (req, res, next) => {
  try {
    const limit        = parseLimit(req.query.limit, { fallback: 25, max: 50 });
    const minObligated = Number.parseFloat(req.query.min_obligated || '0') || 0;
    const minYears     = Math.max(2, parseInt(req.query.min_years || '3', 10) || 3);
    // Minimum first-year spend — ensures CAGR denominator is meaningful.
    const MIN_FIRST_YEAR = 100000; // $100k

    const values = [];
    const existence = buildVendorExistenceClause(req.query, { vendorAlias: 'v', values });

    values.push(minObligated);
    const minObligatedParam = `$${values.length}`;

    values.push(minYears);
    const minYearsParam = `$${values.length}`;

    const result = await db.query(
      // CAGR-based emerging winners:
      // Normalises growth across the full time span so a vendor growing
      // 500% over 2 years (CAGR ~141%) ranks higher than one growing
      // 1000% over 10 years (CAGR ~27%).
      `WITH
       -- First and last fiscal year per vendor, plus active year count
       fl AS (
         SELECT
           vendor_id,
           MIN(fiscal_year)::int                    AS first_year,
           MAX(fiscal_year)::int                    AS last_year,
           COUNT(DISTINCT fiscal_year)::int         AS active_years
         FROM vendor_year_metrics
         GROUP BY vendor_id
         HAVING COUNT(DISTINCT fiscal_year) >= ${minYearsParam}
       ),
       -- Join to get actual spend amounts for first and last year
       fa AS (
         SELECT
           fl.vendor_id,
           fl.first_year,
           fl.last_year,
           fl.active_years,
           fl.last_year - fl.first_year            AS year_span,
           fy.obligated_amount                     AS first_amount,
           ly.obligated_amount                     AS last_amount
         FROM fl
         JOIN vendor_year_metrics fy
           ON fy.vendor_id = fl.vendor_id AND fy.fiscal_year = fl.first_year
         JOIN vendor_year_metrics ly
           ON ly.vendor_id = fl.vendor_id AND ly.fiscal_year = fl.last_year
         -- Must have meaningful first-year spend and actual growth
         WHERE fy.obligated_amount >= ${MIN_FIRST_YEAR}
           AND ly.obligated_amount > fy.obligated_amount
           AND fl.last_year > fl.first_year
       ),
       -- Compute CAGR
       cagr AS (
         SELECT *,
           ROUND(
             (POWER(
               last_amount::numeric / NULLIF(first_amount, 0)::numeric,
               1.0 / year_span
             ) - 1) * 100,
             2
           ) AS cagr_pct
         FROM fa
       )
       SELECT
         v.vendor_id                                AS "vendorId",
         v.cage_code                                AS "cageCode",
         v.uei,
         v.vendor_name                              AS name,
         s.first_award_date                         AS "firstAwardDate",
         c.active_years                             AS "activeYears",
         c.year_span                                AS "yearSpan",
         c.first_year                               AS "firstYear",
         c.last_year                                AS "lastYear",
         c.first_amount                             AS "firstObligated",
         c.last_amount                              AS "lastObligated",
         c.cagr_pct                                 AS "cagrPct",
         COALESCE(s.total_obligated_amount, 0)      AS "totalObligated",
         COALESCE(s.award_count, 0)                 AS "awardCount",
         s.cached_at                                AS "cachedAt"
       FROM cagr c
       JOIN vendor_entities v           ON v.vendor_id = c.vendor_id
       JOIN vendor_investment_summary s ON s.vendor_id = c.vendor_id
       WHERE ${existence.clause}
         AND COALESCE(s.total_obligated_amount, 0) >= ${minObligatedParam}
         AND c.cagr_pct > 25
       ORDER BY c.cagr_pct DESC, COALESCE(s.total_obligated_amount, 0) DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    res.json({
      data: result.rows,
      cachedAt: result.rows[0]?.cachedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor-moat', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, { fallback: 40, max: 80 });
    const values = [];
    const existence = buildVendorExistenceClause(req.query, { vendorAlias: 'v', values });

    const result = await db.query(
      `WITH active_years AS (
         SELECT vendor_id, COUNT(*)::INT AS active_years
         FROM vendor_year_metrics
         GROUP BY vendor_id
       ),
       competition AS (
         SELECT
           a.vendor_id,
           ROUND(100.0 * COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source') / NULLIF(COUNT(*), 0), 2) AS "soleSourceSharePct",
           COUNT(DISTINCT NULLIF(a.contracting_agency_code, ''))::INT AS "distinctAgencyCount"
         FROM award_transactions a
         GROUP BY a.vendor_id
       )
       SELECT
         s.vendor_id AS "vendorId",
         s.cage_code AS "cageCode",
         s.uei,
         s.company_name AS name,
         COALESCE(ay.active_years, 0) AS "activeYears",
         COALESCE(s.total_obligated_amount, 0) AS "totalObligated",
         COALESCE(s.award_count, 0) AS "awardCount",
         COALESCE(c."soleSourceSharePct", 0) AS "soleSourceSharePct",
         COALESCE(c."distinctAgencyCount", 0) AS "distinctAgencyCount",
         s.latest_fiscal_year AS "latestFiscalYear",
         s.cached_at AS "cachedAt"
       FROM vendor_investment_summary s
       JOIN vendor_entities v ON v.vendor_id = s.vendor_id
       LEFT JOIN active_years ay ON ay.vendor_id = s.vendor_id
       LEFT JOIN competition c ON c.vendor_id = s.vendor_id
       WHERE ${existence.clause}
       ORDER BY COALESCE(ay.active_years, 0) DESC, COALESCE(s.total_obligated_amount, 0) DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    res.json({
      data: result.rows,
      cachedAt: result.rows[0]?.cachedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/risk-profile/vendor/:vendorId', async (req, res, next) => {
  try {
    const profile = await buildRiskProfile(req.params.vendorId, req.query);
    if (!profile) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.vendorId} not found` } });
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.get('/risk-profile/:cage_code', async (req, res, next) => {
  try {
    const vendor = await findVendorByIdentifier(req.params.cage_code);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.cage_code} not found` } });
    }

    const profile = await buildRiskProfile(vendor.vendorId, req.query);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.get('/sector-heatmap', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, { fallback: 20, max: 40 });
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = [
      `a.naics_code IS NOT NULL`,
      `BTRIM(a.naics_code) <> ''`,
      ...parts.conditions,
    ];
    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(
      `WITH sectors AS (
         SELECT
           a.naics_code AS "naicsCode",
           COALESCE(MAX(n.description), MAX(a.naics_description), a.naics_code) AS "naicsName",
           COUNT(*)::INT AS "awardCount",
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated"
         FROM award_transactions a
         LEFT JOIN naics_codes n ON n.code = a.naics_code
         ${where}
         GROUP BY a.naics_code
         ORDER BY "totalObligated" DESC
         LIMIT $${values.length + 1}
       ),
       ranked_vendors AS (
         SELECT
           a.naics_code AS "naicsCode",
           v.vendor_id AS "vendorId",
           v.cage_code AS "cageCode",
           v.uei,
           v.vendor_name AS name,
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
           ROUND(
             100.0 * SUM(COALESCE(a.award_amount, 0))
             / NULLIF(SUM(SUM(COALESCE(a.award_amount, 0))) OVER (PARTITION BY a.naics_code), 0),
             2
           ) AS "marketSharePct",
           ROW_NUMBER() OVER (
             PARTITION BY a.naics_code
             ORDER BY SUM(COALESCE(a.award_amount, 0)) DESC, v.vendor_name ASC
           ) AS rn
         FROM award_transactions a
         JOIN vendor_entities v ON v.vendor_id = a.vendor_id
         ${where}
         GROUP BY a.naics_code, v.vendor_id, v.cage_code, v.uei, v.vendor_name
       )
       SELECT
         s.*,
         COALESCE(
           json_agg(
             json_build_object(
               'vendorId', rv."vendorId",
               'cageCode', rv."cageCode",
               'uei', rv.uei,
               'name', rv.name,
               'totalObligated', rv."totalObligated",
               'marketSharePct', rv."marketSharePct"
             )
             ORDER BY rv."totalObligated" DESC
           ) FILTER (WHERE rv.rn <= 5),
           '[]'::json
         ) AS "topVendors"
       FROM sectors s
       LEFT JOIN ranked_vendors rv ON rv."naicsCode" = s."naicsCode"
       GROUP BY s."naicsCode", s."naicsName", s."awardCount", s."totalObligated"
       ORDER BY s."totalObligated" DESC`,
      [...values, limit],
    );

    res.json({ data: result.rows, cachedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/sole-source-opportunities', async (req, res, next) => {
  try {
    const groupBy = String(req.query.group_by || 'agency').toLowerCase();
    const limit = parseLimit(req.query.limit, { fallback: 20, max: 50 });

    const groupMap = {
      agency: {
        code: 'a.contracting_agency_code',
        name: 'COALESCE(a.contracting_agency_name, a.contracting_agency_code)',
        extraJoin: '',
      },
      naics: {
        code: 'a.naics_code',
        name: 'COALESCE(n.description, a.naics_description, a.naics_code)',
        extraJoin: 'LEFT JOIN naics_codes n ON n.code = a.naics_code',
      },
      state: {
        code: 'a.place_of_performance_state_code',
        name: 'COALESCE(a.place_of_performance_state_name, a.place_of_performance_state_code)',
        extraJoin: '',
      },
    };

    const group = groupMap[groupBy] || groupMap.agency;
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = [
      `${group.code} IS NOT NULL`,
      `BTRIM(${group.code}) <> ''`,
      ...parts.conditions,
    ];

    const result = await db.query(
      `SELECT
         ${group.code} AS "groupCode",
         ${group.name} AS "groupName",
         SUM(COALESCE(a.award_amount, 0)) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source') AS "soleSourceObligated",
         COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source')::INT AS "soleSourceAwardCount",
         ROUND(100.0 * COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'unknown') / NULLIF(COUNT(*), 0), 2) AS "unknownCompetitionSharePct"
       FROM award_transactions a
       ${group.extraJoin}
       WHERE ${conditions.join(' AND ')}
       GROUP BY ${group.code}, ${group.name}
       HAVING COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source') > 0
       ORDER BY "soleSourceObligated" DESC NULLS LAST
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    res.json({
      groupBy,
      data: result.rows,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/market-concentration', async (req, res, next) => {
  try {
    const groupBy = String(req.query.group_by || 'naics').toLowerCase();
    const limit = parseLimit(req.query.limit, { fallback: 20, max: 50 });

    const groupMap = {
      naics: {
        code: 'a.naics_code',
        name: 'COALESCE(n.description, a.naics_description, a.naics_code)',
        extraJoin: 'LEFT JOIN naics_codes n ON n.code = a.naics_code',
      },
      agency: {
        code: 'a.contracting_agency_code',
        name: 'COALESCE(a.contracting_agency_name, a.contracting_agency_code)',
        extraJoin: '',
      },
    };

    const group = groupMap[groupBy] || groupMap.naics;
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = [
      `${group.code} IS NOT NULL`,
      `BTRIM(${group.code}) <> ''`,
      ...parts.conditions,
    ];

    const result = await db.query(
      `WITH vendor_totals AS (
         SELECT
           ${group.code} AS "groupCode",
           ${group.name} AS "groupName",
           v.vendor_id AS "vendorId",
           v.vendor_name AS "vendorName",
           SUM(COALESCE(a.award_amount, 0)) AS "vendorObligated"
         FROM award_transactions a
         JOIN vendor_entities v ON v.vendor_id = a.vendor_id
         ${group.extraJoin}
         WHERE ${conditions.join(' AND ')}
         GROUP BY ${group.code}, ${group.name}, v.vendor_id, v.vendor_name
       ),
       ranked AS (
         SELECT
           *,
           SUM("vendorObligated") OVER (PARTITION BY "groupCode") AS "groupTotal",
           ROW_NUMBER() OVER (PARTITION BY "groupCode" ORDER BY "vendorObligated" DESC, "vendorName" ASC) AS rn
         FROM vendor_totals
       )
       SELECT
         "groupCode",
         "groupName",
         MAX("groupTotal") AS "totalObligated",
         ROUND(100.0 * SUM("vendorObligated") FILTER (WHERE rn <= 5) / NULLIF(MAX("groupTotal"), 0), 2) AS "top5SharePct",
         ROUND(100.0 * SUM("vendorObligated") FILTER (WHERE rn <= 10) / NULLIF(MAX("groupTotal"), 0), 2) AS "top10SharePct",
         MAX("vendorName") FILTER (WHERE rn = 1) AS "dominantVendor"
       FROM ranked
       GROUP BY "groupCode", "groupName"
       ORDER BY "totalObligated" DESC
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );

    res.json({
      groupBy,
      data: result.rows,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/win-rate/:cage_code', async (req, res, next) => {
  try {
    const vendor = await findVendorByIdentifier(req.params.cage_code);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.cage_code} not found` } });
    }

    const values = [vendor.vendorId];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const where = `WHERE a.vendor_id = $1${parts.conditions.length ? ` AND ${parts.conditions.join(' AND ')}` : ''}`;

    const [winRateResult, setasideHistory] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*)::INT AS "totalAwards",
           COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'competed')::INT AS "competedAwards",
           COUNT(*) FILTER (WHERE ${competitionBucketExpr('a')} = 'sole_source')::INT AS "soleSourceAwards",
           ROUND(AVG(a.number_of_offers_received), 2) AS "avgOffersReceived"
         FROM award_transactions a
         ${where}`,
        values,
      ),
      db.query(
        `SELECT
           ${fiscalYearExpr('a')} AS "fiscalYear",
           a.set_aside_code AS type,
           COALESCE(MAX(a.set_aside_name), a.set_aside_code) AS label
         FROM award_transactions a
         ${where}
         AND a.set_aside_code IS NOT NULL
         AND BTRIM(a.set_aside_code) <> ''
         GROUP BY ${fiscalYearExpr('a')}, a.set_aside_code
         ORDER BY "fiscalYear" ASC, type ASC`,
        values,
      ),
    ]);

    const row = winRateResult.rows[0] || {};
    const totalAwards = Number(row.totalAwards || 0);
    const competedAwards = Number(row.competedAwards || 0);
    const soleSourceAwards = Number(row.soleSourceAwards || 0);
    const history = setasideHistory.rows;
    const graduatedFromSetaside = history.some((entry) => entry.type && entry.type !== 'NONE')
      && ['NONE', 'NO SET ASIDE USED'].includes(history[history.length - 1]?.type);

    res.json({
      vendorId: vendor.vendorId,
      cageCode: vendor.cageCode,
      uei: vendor.uei,
      name: vendor.name,
      totalAwards,
      competedAwards,
      soleSourceAwards,
      competitiveWinRatePct: totalAwards ? Number(((competedAwards / totalAwards) * 100).toFixed(2)) : 0,
      avgOffersReceived: row.avgOffersReceived ? Number(row.avgOffersReceived) : null,
      setasideHistory: history,
      graduatedFromSetaside,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/geographic-clustering', async (req, res, next) => {
  try {
    const vendorsPerState = parseLimit(req.query.limit, { fallback: 5, max: 12 });
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = [
      `a.place_of_performance_state_code IS NOT NULL`,
      `BTRIM(a.place_of_performance_state_code) <> ''`,
      ...parts.conditions,
    ];
    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await db.query(
      `WITH states AS (
         SELECT
           a.place_of_performance_state_code AS "stateCode",
           COALESCE(MAX(a.place_of_performance_state_name), a.place_of_performance_state_code) AS "stateName",
           COUNT(*)::INT AS "awardCount",
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
           ROUND(100.0 * SUM(COALESCE(a.award_amount, 0)) / NULLIF(SUM(SUM(COALESCE(a.award_amount, 0))) OVER (), 0), 2) AS "pctOfNationalTotal"
         FROM award_transactions a
         ${where}
         GROUP BY a.place_of_performance_state_code
       ),
       ranked_vendors AS (
         SELECT
           a.place_of_performance_state_code AS "stateCode",
           v.vendor_id AS "vendorId",
           v.cage_code AS "cageCode",
           v.uei,
           v.vendor_name AS name,
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
           ROUND(
             100.0 * SUM(COALESCE(a.award_amount, 0))
             / NULLIF(SUM(SUM(COALESCE(a.award_amount, 0))) OVER (PARTITION BY a.place_of_performance_state_code), 0),
             2
           ) AS "regionalMarketSharePct",
           ROW_NUMBER() OVER (
             PARTITION BY a.place_of_performance_state_code
             ORDER BY SUM(COALESCE(a.award_amount, 0)) DESC, v.vendor_name ASC
           ) AS rn
         FROM award_transactions a
         JOIN vendor_entities v ON v.vendor_id = a.vendor_id
         ${where}
         GROUP BY a.place_of_performance_state_code, v.vendor_id, v.cage_code, v.uei, v.vendor_name
       )
       SELECT
         s.*,
         COALESCE(
           json_agg(
             json_build_object(
               'vendorId', rv."vendorId",
               'cageCode', rv."cageCode",
               'uei', rv.uei,
               'name', rv.name,
               'totalObligated', rv."totalObligated",
               'regionalMarketSharePct', rv."regionalMarketSharePct"
             )
             ORDER BY rv."totalObligated" DESC
           ) FILTER (WHERE rv.rn <= $${values.length + 1}),
           '[]'::json
         ) AS "topVendors"
       FROM states s
       LEFT JOIN ranked_vendors rv ON rv."stateCode" = s."stateCode"
       GROUP BY s."stateCode", s."stateName", s."awardCount", s."totalObligated", s."pctOfNationalTotal"
       ORDER BY s."totalObligated" DESC`,
      [...values, vendorsPerState],
    );

    res.json({ data: result.rows, cachedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/naics-trends', async (req, res, next) => {
  try {
    const topN = parseLimit(req.query.top_n, { fallback: 5, max: 10 });
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = [
      `a.naics_code IS NOT NULL`,
      `BTRIM(a.naics_code) <> ''`,
      ...parts.conditions,
    ];

    const result = await db.query(
      `WITH base AS (
         SELECT
           ${fiscalYearExpr('a')} AS "fiscalYear",
           a.naics_code AS "naicsCode",
           COALESCE(MAX(n.description), MAX(a.naics_description), a.naics_code) AS "naicsName",
           SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
           COUNT(*)::INT AS "awardCount"
         FROM award_transactions a
         LEFT JOIN naics_codes n ON n.code = a.naics_code
         WHERE ${conditions.join(' AND ')}
         GROUP BY ${fiscalYearExpr('a')}, a.naics_code
       ),
       top_sectors AS (
         SELECT "naicsCode"
         FROM base
         GROUP BY "naicsCode"
         ORDER BY SUM("totalObligated") DESC
         LIMIT $${values.length + 1}
       )
       SELECT b.*
       FROM base b
       JOIN top_sectors ts ON ts."naicsCode" = b."naicsCode"
       ORDER BY b."fiscalYear" ASC, b."totalObligated" DESC`,
      [...values, topN],
    );

    res.json({ data: result.rows, cachedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/repeat-winners', async (req, res, next) => {
  try {
    const values = [];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const conditions = parts.conditions.length ? `WHERE ${parts.conditions.join(' AND ')}` : '';

    const result = await db.query(
      `WITH vendor_years AS (
         SELECT
           a.vendor_id,
           ${fiscalYearExpr('a')} AS fiscal_year,
           SUM(COALESCE(a.award_amount, 0)) AS obligated
         FROM award_transactions a
         ${conditions}
         GROUP BY a.vendor_id, ${fiscalYearExpr('a')}
       ),
       vendor_buckets AS (
         SELECT
           vendor_id,
           COUNT(*)::INT AS active_years,
           SUM(obligated) AS total_obligated
         FROM vendor_years
         GROUP BY vendor_id
       )
       SELECT
         bucket,
         MIN(bucket_order) AS "bucketOrder",
         COUNT(*)::INT AS "vendorCount",
         SUM(total_obligated) AS "totalObligated"
       FROM (
         SELECT
           CASE
             WHEN active_years = 1 THEN '1 year'
             WHEN active_years = 2 THEN '2 years'
             WHEN active_years BETWEEN 3 AND 4 THEN '3-4 years'
             WHEN active_years BETWEEN 5 AND 9 THEN '5-9 years'
             ELSE '10+ years'
           END AS bucket,
           CASE
             WHEN active_years = 1 THEN 1
             WHEN active_years = 2 THEN 2
             WHEN active_years BETWEEN 3 AND 4 THEN 3
             WHEN active_years BETWEEN 5 AND 9 THEN 4
             ELSE 5
           END AS bucket_order,
           total_obligated
         FROM vendor_buckets
       ) bucketed
       GROUP BY bucket
       ORDER BY "bucketOrder" ASC`,
      values,
    );

    res.json({ data: result.rows, cachedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/revenue-stability/vendor/:vendorId', async (req, res, next) => {
  try {
    const vendor = await findVendorByIdentifier(req.params.vendorId);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.vendorId} not found` } });
    }

    const values = [vendor.vendorId];
    const parts = buildAwardFilters(req.query, { alias: 'a', values });
    const where = `WHERE a.vendor_id = $1${parts.conditions.length ? ` AND ${parts.conditions.join(' AND ')}` : ''}`;

    const result = await db.query(
      `WITH base AS (
         SELECT
           ${fiscalYearExpr('a')} AS "fiscalYear",
           COALESCE(NULLIF(a.award_type_description, ''), 'Unknown') AS award_type,
           SUM(COALESCE(a.award_amount, 0)) AS obligated
         FROM award_transactions a
         ${where}
         GROUP BY ${fiscalYearExpr('a')}, COALESCE(NULLIF(a.award_type_description, ''), 'Unknown')
       ),
       top_types AS (
         SELECT award_type
         FROM base
         GROUP BY award_type
         ORDER BY SUM(obligated) DESC
         LIMIT 6
       )
       SELECT
         "fiscalYear",
         CASE WHEN award_type IN (SELECT award_type FROM top_types) THEN award_type ELSE 'Other' END AS "awardType",
         SUM(obligated) AS "totalObligated"
       FROM base
       GROUP BY "fiscalYear", CASE WHEN award_type IN (SELECT award_type FROM top_types) THEN award_type ELSE 'Other' END
       ORDER BY "fiscalYear" ASC, "totalObligated" DESC`,
      values,
    );

    res.json({
      vendorId: vendor.vendorId,
      cageCode: vendor.cageCode,
      uei: vendor.uei,
      name: vendor.name,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
