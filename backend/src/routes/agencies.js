const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

// GET /api/agencies
router.get('/', async (req, res, next) => {
  try {
    const { search, sort = 'total_obligated', order = 'desc', page, limit } = req.query;
    const { page: p, limit: l, offset } = paginate(page, limit);

    const ALLOWED = new Set(['total_obligated', 'award_count', 'contracting_agency_name']);
    const col = ALLOWED.has(sort) ? sort : 'total_obligated';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [`contracting_agency_code IS NOT NULL AND BTRIM(contracting_agency_code) <> ''`];
    const values     = [];

    if (search) {
      values.push(search);
      conditions.push(`contracting_agency_name ILIKE '%' || $${values.length} || '%'`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          contracting_agency_code AS code,
          contracting_agency_name AS name,
          COUNT(*)                AS award_count,
          SUM(award_amount)       AS total_obligated
        FROM award_transactions
        ${where}
        GROUP BY contracting_agency_code, contracting_agency_name
        ORDER BY ${col} ${dir}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `, [...values, l, offset]),
      db.query(`
        SELECT COUNT(DISTINCT contracting_agency_code) AS total
        FROM award_transactions
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

// GET /api/agencies/:code/awards
router.get('/:code/awards', async (req, res, next) => {
  try {
    const { code } = req.params;
    const { sort = 'award_date', order = 'desc', page, limit } = req.query;
    const { page: p, limit: l, offset } = paginate(page, limit);

    const ALLOWED = new Set(['award_amount', 'award_date', 'date_signed']);
    const col = ALLOWED.has(sort) ? sort : 'award_date';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

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
          a.place_of_performance_state_code AS state_code,
          a.set_aside_code,
          a.extent_competed_code,
          a.description_of_requirement,
          v.cage_code              AS vendor_cage,
          v.vendor_name            AS vendor_name
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.contracting_agency_code = $1
        ORDER BY a.${col} ${dir}
        LIMIT $2 OFFSET $3
      `, [code, l, offset]),
      db.query(
        `SELECT COUNT(*) AS total FROM award_transactions WHERE contracting_agency_code = $1`,
        [code]
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

// GET /api/agencies/:code/vendors
router.get('/:code/vendors', async (req, res, next) => {
  try {
    const { code } = req.params;
    const { sort = 'total_obligated', order = 'desc', page, limit } = req.query;
    const { page: p, limit: l, offset } = paginate(page, limit);

    const ALLOWED = new Set(['total_obligated', 'award_count', 'vendor_name']);
    const col = ALLOWED.has(sort) ? sort : 'total_obligated';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          v.cage_code,
          v.uei,
          v.vendor_name             AS name,
          v.state_code,
          v.socio_economic_indicator,
          COUNT(*)                  AS award_count,
          SUM(a.award_amount)       AS total_obligated
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.contracting_agency_code = $1
          AND v.cage_code IS NOT NULL AND BTRIM(v.cage_code) <> ''
        GROUP BY v.cage_code, v.uei, v.vendor_name, v.state_code, v.socio_economic_indicator
        ORDER BY ${col} ${dir}
        LIMIT $2 OFFSET $3
      `, [code, l, offset]),
      db.query(`
        SELECT COUNT(DISTINCT v.cage_code) AS total
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.contracting_agency_code = $1
          AND v.cage_code IS NOT NULL AND BTRIM(v.cage_code) <> ''
      `, [code]),
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
