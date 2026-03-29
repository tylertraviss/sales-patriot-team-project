const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

const ALLOWED_SORT = new Set([
  'award_date', 'award_amount', 'vendor_name', 'naics_code',
  'place_of_performance_state_code', 'award_type_description',
]);

const AWARD_HEADERS = [
  { key: 'vendor_name',                     label: 'Vendor Name',     type: 'string'   },
  { key: 'cage_code',                       label: 'CAGE Code',       type: 'string'   },
  { key: 'piid',                            label: 'Contract (PIID)', type: 'string'   },
  { key: 'award_amount',                    label: 'Award Amount',    type: 'currency' },
  { key: 'award_date',                      label: 'Award Date',      type: 'date'     },
  { key: 'award_type_description',          label: 'Award Type',      type: 'string'   },
  { key: 'naics_code',                      label: 'NAICS',           type: 'string'   },
  { key: 'place_of_performance_state_code', label: 'State',           type: 'string'   },
  { key: 'contracting_agency_name',         label: 'Agency',          type: 'string'   },
  { key: 'extent_competed_name',            label: 'Competition',     type: 'string'   },
];

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
  return { page: p, limit: l, offset: (p - 1) * l };
}

// GET /api/awards/headers
router.get('/headers', (req, res) => {
  res.json({ headers: AWARD_HEADERS });
});

// GET /api/awards
router.get('/', async (req, res, next) => {
  try {
    const {
      page, limit,
      sortBy  = 'award_date',
      sortDir = 'DESC',
      year,
      agencyCode,
      naicsCode,
      stateCode,
      awardType,
      setAsideCode,
      extentCompeted,
      search,
    } = req.query;

    const { page: p, limit: l, offset } = paginate(page, limit);
    const col = ALLOWED_SORT.has(sortBy) ? `at.${sortBy}` : 'at.award_date';
    const dir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const values     = [];
    const conditions = [];

    if (year)          conditions.push(`at.award_fiscal_year = $${values.push(parseInt(year, 10))}`);
    if (agencyCode)    conditions.push(`at.contracting_agency_code = $${values.push(agencyCode)}`);
    if (naicsCode)     conditions.push(`at.naics_code = $${values.push(naicsCode)}`);
    if (stateCode)     conditions.push(`at.place_of_performance_state_code = $${values.push(stateCode.toUpperCase())}`);
    if (awardType)     conditions.push(`at.award_type_description ILIKE $${values.push(awardType)}`);
    if (setAsideCode)  conditions.push(`at.set_aside_code = $${values.push(setAsideCode)}`);
    if (extentCompeted) conditions.push(`at.extent_competed_code = $${values.push(extentCompeted)}`);
    if (search)        conditions.push(`at.description_of_requirement ILIKE $${values.push('%' + search + '%')}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          at.award_tx_id,
          ve.vendor_name,
          ve.cage_code,
          ve.uei,
          at.piid,
          at.modification_number,
          at.award_amount,
          at.award_date,
          at.date_signed,
          at.award_type_description,
          at.naics_code,
          at.naics_description,
          at.product_service_code,
          at.place_of_performance_state_code,
          at.place_of_performance_city,
          at.contracting_agency_code,
          at.contracting_agency_name,
          at.set_aside_code,
          at.set_aside_name,
          at.extent_competed_code,
          at.extent_competed_name,
          at.description_of_requirement,
          at.award_fiscal_year
        FROM award_transactions at
        JOIN vendor_entities ve ON ve.vendor_id = at.vendor_id
        ${where}
        ORDER BY ${col} ${dir}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `, [...values, l, offset]),
      db.query(`
        SELECT COUNT(*) AS total
        FROM award_transactions at
        JOIN vendor_entities ve ON ve.vendor_id = at.vendor_id
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
