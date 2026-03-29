const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const logger  = require('../logger');

const AWARD_HEADERS = [
  { key: 'vendor_name',      label: 'Vendor Name',      type: 'string'   },
  { key: 'cage_code',        label: 'CAGE Code',        type: 'string'   },
  { key: 'piid',             label: 'Contract (PIID)',  type: 'string'   },
  { key: 'award_amount',     label: 'Award Amount',     type: 'currency' },
  { key: 'award_date',       label: 'Award Date',       type: 'date'     },
  { key: 'award_type_description', label: 'Award Type', type: 'string'   },
  { key: 'naics_code',       label: 'NAICS',            type: 'string'   },
  { key: 'place_of_performance_state_code', label: 'State', type: 'string' },
  { key: 'contracting_agency_name', label: 'Agency',   type: 'string'   },
  { key: 'extent_competed_name', label: 'Competition', type: 'string'   },
];

// GET /api/awards/headers
router.get('/headers', (req, res) => {
  logger.debug('headers requested', { requestId: req.id });
  res.json({ headers: AWARD_HEADERS });
});

// GET /api/awards
router.get('/', async (req, res, next) => {
  try {
    const {
      page    = '1',
      limit   = '50',
      sortBy  = 'award_date',
      sortDir = 'DESC',
      year,
      agencyCode,
      naicsCode,
      stateCode,
      awardType,
      extentCompeted,
      search,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    const allowedSortCols = new Set([
      'award_date', 'award_amount', 'vendor_name', 'naics_code',
      'place_of_performance_state_code', 'award_type_description',
    ]);
    const col = allowedSortCols.has(sortBy) ? `at.${sortBy}` : 'at.award_date';
    const dir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const values = [];
    const conditions = [];

    if (year)          conditions.push(`at.award_fiscal_year = $${values.push(parseInt(year))}`);
    if (agencyCode)    conditions.push(`at.contracting_agency_code = $${values.push(agencyCode)}`);
    if (naicsCode)     conditions.push(`at.naics_code = $${values.push(naicsCode)}`);
    if (stateCode)     conditions.push(`at.place_of_performance_state_code = $${values.push(stateCode)}`);
    if (awardType)     conditions.push(`at.award_type_description = $${values.push(awardType)}`);
    if (extentCompeted) conditions.push(`at.extent_competed_code = $${values.push(extentCompeted)}`);
    if (search)        conditions.push(`at.description_of_requirement ILIKE $${values.push('%' + search + '%')}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        at.award_tx_id,
        ve.vendor_name,
        ve.cage_code,
        ve.uei,
        at.piid,
        at.award_amount,
        at.award_date,
        at.award_type_description,
        at.naics_code,
        at.naics_description,
        at.place_of_performance_state_code,
        at.place_of_performance_city,
        at.contracting_agency_name,
        at.extent_competed_name,
        at.description_of_requirement,
        at.award_fiscal_year
      FROM award_transactions at
      JOIN vendor_entities ve ON ve.vendor_id = at.vendor_id
      ${where}
      ORDER BY ${col} ${dir}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM award_transactions at
      JOIN vendor_entities ve ON ve.vendor_id = at.vendor_id
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...values, limitNum, offset]),
      db.query(countQuery, values),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    logger.info('awards list served', { requestId: req.id, total, page: pageNum });

    res.json({
      data: dataResult.rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
