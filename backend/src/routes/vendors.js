const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

const ALLOWED_SORT = new Set(['vendor_name', 'annual_revenue', 'number_of_employees']);

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

// GET /api/vendors
router.get('/', async (req, res, next) => {
  try {
    const {
      search, state_code, country_code,
      sort = 'vendor_name', order = 'asc',
      page, limit,
    } = req.query;

    const { page: p, limit: l, offset } = paginate(page, limit);
    const col = ALLOWED_SORT.has(sort) ? sort : 'vendor_name';
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

    // Only vendors with a cage_code (our primary identifier)
    conditions.push(`v.cage_code IS NOT NULL AND BTRIM(v.cage_code) <> ''`);

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          v.cage_code,
          v.uei,
          v.vendor_name        AS name,
          v.state_code,
          v.country_code,
          v.socio_economic_indicator,
          v.annual_revenue,
          v.number_of_employees,
          v.vendor_registration_date AS registration_date
        FROM vendor_entities v
        ${where}
        ORDER BY ${col} ${dir}
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
        v.cage_code,
        v.uei,
        v.vendor_name             AS name,
        v.state_code,
        v.country_code,
        v.socio_economic_indicator,
        v.annual_revenue,
        v.number_of_employees,
        v.vendor_registration_date AS registration_date,
        COALESCE(s.award_count, 0)            AS award_count,
        COALESCE(s.total_obligated_amount, 0) AS total_obligated
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

// GET /api/vendors/:cage_code/awards
router.get('/:cage_code/awards', async (req, res, next) => {
  try {
    const { cage_code } = req.params;
    const { sort = 'award_date', order = 'desc', page, limit } = req.query;
    const { page: p, limit: l, offset } = paginate(page, limit);

    const ALLOWED = new Set(['award_amount', 'award_date', 'date_signed']);
    const col = ALLOWED.has(sort) ? sort : 'award_date';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Verify vendor exists
    const vendorCheck = await db.query(
      `SELECT vendor_id FROM vendor_entities WHERE cage_code = $1`,
      [cage_code.toUpperCase()]
    );
    if (!vendorCheck.rows.length) {
      return res.status(404).json({ error: { status: 404, message: `Vendor ${cage_code} not found` } });
    }

    const vendor_id = vendorCheck.rows[0].vendor_id;

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          a.piid,
          a.modification_number,
          a.award_amount           AS dollars_obligated,
          a.award_date,
          a.date_signed,
          a.award_type_description AS award_type,
          a.naics_code,
          a.naics_description,
          a.product_service_code,
          a.contracting_agency_code AS agency_code,
          a.contracting_agency_name AS agency_name,
          a.place_of_performance_state_code AS state_code,
          a.set_aside_code,
          a.set_aside_name,
          a.extent_competed_code,
          a.extent_competed_name,
          a.description_of_requirement
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
