const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

const ALLOWED_SORT = new Set(['award_amount', 'award_date', 'date_signed']);

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

// GET /api/awards
router.get('/', async (req, res, next) => {
  try {
    const {
      year, agency_code, naics_code, state_code,
      award_type, set_aside_code, extent_competed,
      search,
      sort = 'award_date', order = 'desc',
      page, limit,
    } = req.query;

    const { page: p, limit: l, offset } = paginate(page, limit);
    const col = ALLOWED_SORT.has(sort) ? sort : 'award_date';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const values     = [];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`COALESCE(a.award_fiscal_year, a.contract_fiscal_year) = $${values.length}`);
    }
    if (agency_code) {
      values.push(agency_code);
      conditions.push(`a.contracting_agency_code = $${values.length}`);
    }
    if (naics_code) {
      values.push(naics_code);
      conditions.push(`a.naics_code = $${values.length}`);
    }
    if (state_code) {
      values.push(state_code.toUpperCase());
      conditions.push(`a.place_of_performance_state_code = $${values.length}`);
    }
    if (award_type) {
      values.push(award_type);
      conditions.push(`a.award_type_description ILIKE $${values.length}`);
    }
    if (set_aside_code) {
      values.push(set_aside_code);
      conditions.push(`a.set_aside_code = $${values.length}`);
    }
    if (extent_competed) {
      values.push(extent_competed);
      conditions.push(`a.extent_competed_code = $${values.length}`);
    }
    if (search) {
      values.push(search);
      conditions.push(`a.description_of_requirement ILIKE '%' || $${values.length} || '%'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

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
          a.description_of_requirement,
          v.cage_code               AS vendor_cage,
          v.uei                     AS vendor_uei,
          v.vendor_name             AS vendor_name
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        ${where}
        ORDER BY a.${col} ${dir}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `, [...values, l, offset]),
      db.query(`
        SELECT COUNT(*) AS total
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
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

module.exports = router;
