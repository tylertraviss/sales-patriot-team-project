const express = require('express');

const router = express.Router();
const db = require('../db/connection');

const SORT_KEY_MAP = {
  name: 'name',
  annual_revenue: 'annual_revenue',
  annualRevenue: 'annual_revenue',
  number_of_employees: 'number_of_employees',
  numberOfEmployees: 'number_of_employees',
  total_obligated: 'total_obligated',
  totalObligated: 'total_obligated',
  award_count: 'award_count',
  awardCount: 'award_count',
};

function paginate(page, limit) {
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

function toSortCol(sort) {
  const map = {
    name: 'v.vendor_name',
    annual_revenue: 'v.annual_revenue',
    number_of_employees: 'v.number_of_employees',
    total_obligated: 'COALESCE(s.total_obligated_amount, 0)',
    award_count: 'COALESCE(s.award_count, 0)',
  };

  return map[sort] || map.total_obligated;
}

function fiscalYearExpr(alias = 'a') {
  return `COALESCE(${alias}.award_fiscal_year, ${alias}.contract_fiscal_year, EXTRACT(YEAR FROM COALESCE(${alias}.award_date, ${alias}.date_signed, ${alias}.reveal_date))::INT)`;
}

function buildVendorAwardExistence(query, { vendorAlias = 'v', values = [] } = {}) {
  const conditions = [`a.vendor_id = ${vendorAlias}.vendor_id`];

  if (query.naics_code) {
    values.push(String(query.naics_code).trim().toUpperCase());
    conditions.push(`a.naics_code = $${values.length}`);
  }

  if (query.agency_code) {
    values.push(String(query.agency_code).trim().toUpperCase());
    conditions.push(`a.contracting_agency_code = $${values.length}`);
  }

  if (query.set_aside_code) {
    values.push(String(query.set_aside_code).trim().toUpperCase());
    conditions.push(`a.set_aside_code = $${values.length}`);
  }

  if (query.year) {
    values.push(Number.parseInt(query.year, 10));
    conditions.push(`${fiscalYearExpr('a')} = $${values.length}`);
  }

  return {
    clause: `EXISTS (SELECT 1 FROM award_transactions a WHERE ${conditions.join(' AND ')})`,
    values,
  };
}

async function findVendor(whereClause, params) {
  const result = await db.query(
    `SELECT
       v.vendor_id AS "vendorId",
       v.cage_code AS "cageCode",
       v.uei,
       v.vendor_name AS name,
       v.city,
       v.congressional_district AS "congressionalDistrict",
       v.state_code AS "stateCode",
       v.state_name AS "stateName",
       v.country_code AS "countryCode",
       v.country_name AS "countryName",
       v.socio_economic_indicator AS "socioEconomicIndicator",
       v.annual_revenue AS "annualRevenue",
       v.number_of_employees AS "numberOfEmployees",
       v.vendor_registration_date AS "registrationDate",
       COALESCE(s.award_count, 0) AS "awardCount",
       COALESCE(s.total_obligated_amount, 0) AS "totalObligated",
       s.latest_fiscal_year AS "latestFiscalYear"
     FROM vendor_entities v
     LEFT JOIN vendor_investment_summary s ON s.vendor_id = v.vendor_id
     WHERE ${whereClause}
     LIMIT 1`,
    params,
  );

  return result.rows[0] || null;
}

async function buildVendorAwardSummary(vendor) {
  const vendorId = vendor.vendorId;

  const [byYear, byAgency, byCompetition, byAwardType, totals] = await Promise.all([
    db.query(
      `SELECT
         ${fiscalYearExpr('a')} AS "fiscalYear",
         SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
         COUNT(*)::INT AS "awardCount"
       FROM award_transactions a
       WHERE a.vendor_id = $1
         AND ${fiscalYearExpr('a')} IS NOT NULL
       GROUP BY ${fiscalYearExpr('a')}
       ORDER BY "fiscalYear" ASC`,
      [vendorId],
    ),
    db.query(
      `SELECT
         a.contracting_agency_code AS "agencyCode",
         COALESCE(MAX(a.contracting_agency_name), a.contracting_agency_code) AS "agencyName",
         SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
         COUNT(*)::INT AS "awardCount"
       FROM award_transactions a
       WHERE a.vendor_id = $1
         AND a.contracting_agency_code IS NOT NULL
         AND BTRIM(a.contracting_agency_code) <> ''
       GROUP BY a.contracting_agency_code
       ORDER BY "totalObligated" DESC
       LIMIT 10`,
      [vendorId],
    ),
    db.query(
      `SELECT
         COALESCE(a.extent_competed_code, 'UNKNOWN') AS "extentCompetedCode",
         COALESCE(a.extent_competed_name, 'Unknown') AS "extentCompetedName",
         COUNT(*)::INT AS "awardCount",
         SUM(COALESCE(a.award_amount, 0)) AS "totalObligated"
       FROM award_transactions a
       WHERE a.vendor_id = $1
       GROUP BY COALESCE(a.extent_competed_code, 'UNKNOWN'), COALESCE(a.extent_competed_name, 'Unknown')
       ORDER BY "awardCount" DESC`,
      [vendorId],
    ),
    db.query(
      `SELECT
         COALESCE(NULLIF(a.award_type_description, ''), 'Unknown') AS "awardType",
         SUM(COALESCE(a.award_amount, 0)) AS "totalObligated",
         COUNT(*)::INT AS "awardCount"
       FROM award_transactions a
       WHERE a.vendor_id = $1
       GROUP BY COALESCE(NULLIF(a.award_type_description, ''), 'Unknown')
       ORDER BY "totalObligated" DESC
       LIMIT 8`,
      [vendorId],
    ),
    db.query(
      `SELECT
         COUNT(*)::INT AS "awardCount",
         SUM(COALESCE(a.award_amount, 0)) AS "totalObligated"
       FROM award_transactions a
       WHERE a.vendor_id = $1`,
      [vendorId],
    ),
  ]);

  return {
    vendorId,
    cageCode: vendor.cageCode,
    uei: vendor.uei,
    name: vendor.name,
    totalObligated: totals.rows[0]?.totalObligated ?? 0,
    awardCount: Number(totals.rows[0]?.awardCount ?? 0),
    byYear: byYear.rows,
    byAgency: byAgency.rows,
    byCompetition: byCompetition.rows,
    byAwardType: byAwardType.rows,
  };
}

async function listVendorAwards(vendorId, query) {
  const { page, limit, offset } = paginate(query.page, query.limit);
  const allowed = new Set(['award_amount', 'award_date', 'date_signed']);
  const sort = allowed.has(query.sort) ? query.sort : 'award_date';
  const order = String(query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [dataResult, countResult] = await Promise.all([
    db.query(
      `SELECT
         a.award_tx_id AS "awardTxId",
         a.piid,
         a.modification_number AS "modificationNumber",
         a.award_amount AS "dollarsObligated",
         a.award_date AS "awardDate",
         a.date_signed AS "dateSigned",
         a.award_type_description AS "awardType",
         a.naics_code AS "naicsCode",
         a.naics_description AS "naicsDescription",
         a.product_service_code AS "productServiceCode",
         a.contracting_agency_code AS "agencyCode",
         a.contracting_agency_name AS "agencyName",
         a.place_of_performance_state_code AS "stateCode",
         a.set_aside_code AS "setAsideCode",
         a.set_aside_name AS "setAsideName",
         a.extent_competed_code AS "extentCompetedCode",
         a.extent_competed_name AS "extentCompetedName",
         a.description_of_requirement AS "description"
       FROM award_transactions a
       WHERE a.vendor_id = $1
       ORDER BY ${sort} ${order}
       LIMIT $2 OFFSET $3`,
      [vendorId, limit, offset],
    ),
    db.query(
      `SELECT COUNT(*)::INT AS total FROM award_transactions WHERE vendor_id = $1`,
      [vendorId],
    ),
  ]);

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total: Number(countResult.rows[0].total || 0),
      totalPages: Math.ceil(Number(countResult.rows[0].total || 0) / limit),
    },
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { search, state_code, country_code, sort = 'total_obligated', order = 'desc', page, limit } = req.query;
    const paging = paginate(page, limit);
    const sortKey = SORT_KEY_MAP[sort] || 'total_obligated';
    const direction = String(order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const values = [];
    const conditions = [];

    if (search) {
      values.push(search);
      conditions.push(`v.vendor_name ILIKE '%' || $${values.length} || '%'`);
    }

    if (state_code) {
      values.push(String(state_code).trim().toUpperCase());
      conditions.push(`v.state_code = $${values.length}`);
    }

    if (country_code) {
      values.push(String(country_code).trim().toUpperCase());
      conditions.push(`v.country_code = $${values.length}`);
    }

    if (req.query.naics_code || req.query.agency_code || req.query.set_aside_code || req.query.year) {
      const exists = buildVendorAwardExistence(req.query, { vendorAlias: 'v', values });
      conditions.push(exists.clause);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT
           v.vendor_id AS "vendorId",
           v.cage_code AS "cageCode",
           v.uei,
           v.vendor_name AS name,
           v.city,
           v.congressional_district AS "congressionalDistrict",
           v.state_code AS "stateCode",
           v.country_code AS "countryCode",
           v.socio_economic_indicator AS "socioEconomicIndicator",
           v.annual_revenue AS "annualRevenue",
           v.number_of_employees AS "numberOfEmployees",
           v.vendor_registration_date AS "registrationDate",
           COALESCE(s.award_count, 0) AS "awardCount",
           COALESCE(s.total_obligated_amount, 0) AS "totalObligated",
           s.latest_fiscal_year AS "latestFiscalYear"
         FROM vendor_entities v
         LEFT JOIN vendor_investment_summary s ON s.vendor_id = v.vendor_id
         ${where}
         ORDER BY ${toSortCol(sortKey)} ${direction}, v.vendor_name ASC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, paging.limit, paging.offset],
      ),
      db.query(
        `SELECT COUNT(*)::INT AS total
         FROM vendor_entities v
         ${where}`,
        values,
      ),
    ]);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: paging.page,
        limit: paging.limit,
        total: Number(countResult.rows[0].total || 0),
        totalPages: Math.ceil(Number(countResult.rows[0].total || 0) / paging.limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/id/:vendorId', async (req, res, next) => {
  try {
    const vendor = await findVendor(`v.vendor_id::text = $1`, [req.params.vendorId]);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.vendorId} not found` } });
    }

    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

router.get('/id/:vendorId/awards/summary', async (req, res, next) => {
  try {
    const vendor = await findVendor(`v.vendor_id::text = $1`, [req.params.vendorId]);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.vendorId} not found` } });
    }

    res.json(await buildVendorAwardSummary(vendor));
  } catch (error) {
    next(error);
  }
});

router.get('/id/:vendorId/awards', async (req, res, next) => {
  try {
    const vendor = await findVendor(`v.vendor_id::text = $1`, [req.params.vendorId]);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.vendorId} not found` } });
    }

    res.json(await listVendorAwards(vendor.vendorId, req.query));
  } catch (error) {
    next(error);
  }
});

router.get('/:cage_code/awards/summary', async (req, res, next) => {
  try {
    const identifier = String(req.params.cage_code).trim().toUpperCase();
    const vendor = await findVendor(`v.cage_code = $1 OR v.uei = $1`, [identifier]);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.cage_code} not found` } });
    }

    res.json(await buildVendorAwardSummary(vendor));
  } catch (error) {
    next(error);
  }
});

router.get('/:cage_code/awards', async (req, res, next) => {
  try {
    const identifier = String(req.params.cage_code).trim().toUpperCase();
    const vendor = await findVendor(`v.cage_code = $1 OR v.uei = $1`, [identifier]);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.cage_code} not found` } });
    }

    res.json(await listVendorAwards(vendor.vendorId, req.query));
  } catch (error) {
    next(error);
  }
});

router.get('/:cage_code', async (req, res, next) => {
  try {
    const identifier = String(req.params.cage_code).trim().toUpperCase();
    const vendor = await findVendor(`v.cage_code = $1 OR v.uei = $1`, [identifier]);
    if (!vendor) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${req.params.cage_code} not found` } });
    }

    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
