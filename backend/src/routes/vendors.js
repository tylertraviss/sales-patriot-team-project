const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

const ALLOWED_SORT = new Set(['name', 'annual_revenue', 'number_of_employees', 'total_obligated', 'award_count']);

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

function toSortCol(sort) {
  const map = {
    name:                'v.vendor_name',
    annual_revenue:      'v.annual_revenue',
    number_of_employees: 'v.number_of_employees',
    total_obligated:     'COALESCE(s.total_obligated_amount, 0)',
    award_count:         'COALESCE(s.award_count, 0)',
  };
  return map[sort] || map['total_obligated'];
}

// GET /api/vendors
router.get('/', async (req, res, next) => {
  try {
    const {
      search, state_code, country_code,
      naics_code, agency_code, set_aside_code, year,
      sort = 'total_obligated', order = 'asc',
      page, limit,
    } = req.query;

    const { page: p, limit: l, offset } = paginate(page, limit);
    const col = ALLOWED_SORT.has(sort) ? sort : 'total_obligated';
    const dir = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const conditions = [];
    const values     = [];

    if (search) {
      values.push(search);
      conditions.push(`v.vendor_name ILIKE '%' || $${values.length} || '%'`);
    }
    if (state_code) {
      values.push(state_code.toUpperCase());
      conditions.push(`v.state_code = $${values.length}`);
    }
    if (country_code) {
      values.push(country_code.toUpperCase());
      conditions.push(`v.country_code = $${values.length}`);
    }
    if (naics_code) {
      values.push(naics_code);
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id AND a.naics_code = $${values.length}
      )`);
    }
    if (agency_code) {
      values.push(agency_code);
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id AND a.contracting_agency_code = $${values.length}
      )`);
    }
    if (set_aside_code) {
      values.push(set_aside_code);
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id AND a.set_aside_code = $${values.length}
      )`);
    }
    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`EXISTS (
        SELECT 1 FROM award_transactions a
        WHERE a.vendor_id = v.vendor_id
          AND COALESCE(a.award_fiscal_year, a.contract_fiscal_year) = $${values.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          v.cage_code                                     AS "cageCode",
          v.uei,
          v.vendor_name                                   AS "name",
          v.state_code                                    AS "stateCode",
          v.country_code                                  AS "countryCode",
          v.socio_economic_indicator                      AS "socioEconomicIndicator",
          v.annual_revenue                                AS "annualRevenue",
          v.number_of_employees                           AS "numberOfEmployees",
          v.vendor_registration_date                      AS "registrationDate",
          COALESCE(s.award_count, 0)                      AS "awardCount",
          COALESCE(s.total_obligated_amount, 0)           AS "totalObligated"
        FROM vendor_entities v
        LEFT JOIN vendor_investment_summary s ON s.cage_code = v.cage_code
        ${where}
        ORDER BY ${toSortCol(col)} ${dir}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `, [...values, l, offset]),
      db.query(`
        SELECT COUNT(*) AS total
        FROM vendor_entities v
        ${where}
      `, values),
    ]);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: p, limit: l,
        total: parseInt(countResult.rows[0].total, 10),
        totalPages: Math.ceil(countResult.rows[0].total / l),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:cage_code
router.get('/:cage_code', async (req, res, next) => {
  try {
    const { cage_code } = req.params;

    const result = await db.query(`
      SELECT
        v.cage_code                                       AS "cageCode",
        v.uei,
        v.vendor_name                                     AS "name",
        v.state_code                                      AS "stateCode",
        v.country_code                                    AS "countryCode",
        v.socio_economic_indicator                        AS "socioEconomicIndicator",
        v.annual_revenue                                  AS "annualRevenue",
        v.number_of_employees                             AS "numberOfEmployees",
        v.vendor_registration_date                        AS "registrationDate",
        COALESCE(s.award_count, 0)                        AS "awardCount",
        COALESCE(s.total_obligated_amount, 0)             AS "totalObligated"
      FROM vendor_entities v
      LEFT JOIN vendor_investment_summary s ON s.cage_code = v.cage_code
      WHERE v.cage_code = $1
    `, [cage_code.toUpperCase()]);

    if (!result.rows.length) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${cage_code} not found` } });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:cage_code/awards/summary
router.get('/:cage_code/awards/summary', async (req, res, next) => {
  try {
    const { cage_code } = req.params;

    const vendorCheck = await db.query(
      `SELECT vendor_id FROM vendor_entities WHERE cage_code = $1`,
      [cage_code.toUpperCase()]
    );
    if (!vendorCheck.rows.length) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${cage_code} not found` } });
    }
    const { vendor_id } = vendorCheck.rows[0];

    const [byYear, byAgency, byCompetition, totals] = await Promise.all([
      // Spend by fiscal year
      db.query(`
        SELECT
          COALESCE(award_fiscal_year, contract_fiscal_year) AS "fiscalYear",
          SUM(award_amount)                                  AS "totalObligated",
          COUNT(*)                                           AS "awardCount"
        FROM award_transactions
        WHERE vendor_id = $1
          AND COALESCE(award_fiscal_year, contract_fiscal_year) IS NOT NULL
        GROUP BY "fiscalYear"
        ORDER BY "fiscalYear" ASC
      `, [vendor_id]),

      // By agency
      db.query(`
        SELECT
          contracting_agency_code AS "agencyCode",
          contracting_agency_name AS "agencyName",
          SUM(award_amount)       AS "totalObligated",
          COUNT(*)                AS "awardCount"
        FROM award_transactions
        WHERE vendor_id = $1
          AND contracting_agency_code IS NOT NULL
        GROUP BY contracting_agency_code, contracting_agency_name
        ORDER BY "totalObligated" DESC
        LIMIT 10
      `, [vendor_id]),

      // By competition (extent competed)
      db.query(`
        SELECT
          extent_competed_code AS "extentCompetedCode",
          extent_competed_name AS "extentCompetedName",
          COUNT(*)             AS "awardCount",
          SUM(award_amount)    AS "totalObligated"
        FROM award_transactions
        WHERE vendor_id = $1
          AND extent_competed_code IS NOT NULL
        GROUP BY extent_competed_code, extent_competed_name
        ORDER BY "awardCount" DESC
      `, [vendor_id]),

      // Totals
      db.query(`
        SELECT
          COUNT(*)          AS "awardCount",
          SUM(award_amount) AS "totalObligated"
        FROM award_transactions
        WHERE vendor_id = $1
      `, [vendor_id]),
    ]);

    res.json({
      cageCode:       cage_code.toUpperCase(),
      totalObligated: totals.rows[0]?.totalObligated ?? 0,
      awardCount:     parseInt(totals.rows[0]?.awardCount ?? 0, 10),
      byYear:         byYear.rows,
      byAgency:       byAgency.rows,
      byCompetition:  byCompetition.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:cage_code/awards
router.get('/:cage_code/awards', async (req, res, next) => {
  try {
    const { cage_code } = req.params;
    const { sort = 'award_date', order = 'desc', page, limit } = req.query;
    const { page: p, limit: l, offset } = paginate(page, limit);

    const ALLOWED = new Set(['award_amount', 'award_date', 'date_signed']);
    const col = ALLOWED.has(sort) ? sort : 'award_date';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const vendorCheck = await db.query(
      `SELECT vendor_id FROM vendor_entities WHERE cage_code = $1`,
      [cage_code.toUpperCase()]
    );
    if (!vendorCheck.rows.length) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${cage_code} not found` } });
    }

    const { vendor_id } = vendorCheck.rows[0];

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          a.piid,
          a.modification_number                               AS "modificationNumber",
          a.award_amount                                      AS "dollarsObligated",
          a.award_date                                        AS "awardDate",
          a.date_signed                                       AS "dateSigned",
          a.award_type_description                            AS "awardType",
          a.naics_code                                        AS "naicsCode",
          a.naics_description                                 AS "naicsDescription",
          a.product_service_code                              AS "productServiceCode",
          a.contracting_agency_code                           AS "agencyCode",
          a.contracting_agency_name                           AS "agencyName",
          a.place_of_performance_state_code                   AS "stateCode",
          a.set_aside_code                                    AS "setAsideCode",
          a.set_aside_name                                    AS "setAsideName",
          a.extent_competed_code                              AS "extentCompetedCode",
          a.extent_competed_name                              AS "extentCompetedName",
          a.description_of_requirement                        AS "description"
        FROM award_transactions a
        WHERE a.vendor_id = $1
        ORDER BY ${col} ${dir}
        LIMIT $2 OFFSET $3
      `, [vendor_id, l, offset]),
      db.query(
        `SELECT COUNT(*) AS total FROM award_transactions WHERE vendor_id = $1`,
        [vendor_id]
      ),
    ]);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: p, limit: l,
        total: parseInt(countResult.rows[0].total, 10),
        totalPages: Math.ceil(countResult.rows[0].total / l),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
