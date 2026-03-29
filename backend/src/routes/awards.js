const express = require('express');
const router = express.Router();
const db = require('../db/connection');

/**
 * Column definitions returned to the frontend so it can render
 * the awards table dynamically without hard-coding field names.
 */
const AWARD_HEADERS = [
  { key: 'cage_code',       label: 'CAGE Code',        type: 'string'   },
  { key: 'company_name',    label: 'Company Name',     type: 'string'   },
  { key: 'contract_number', label: 'Contract Number',  type: 'string'   },
  { key: 'award_amount',    label: 'Award Amount',     type: 'currency' },
  { key: 'award_date',      label: 'Award Date',       type: 'date'     },
  { key: 'dla_office',      label: 'DLA Office',       type: 'string'   },
  { key: 'description',     label: 'Description',      type: 'text'     },
];

// GET /api/awards/headers
// Must be registered BEFORE /:cageCode to avoid route shadowing.
router.get('/headers', (_req, res) => {
  res.json({ headers: AWARD_HEADERS });
});

// GET /api/awards
// Query params: cageCode, page, limit, sortBy, sortDir
router.get('/', async (req, res, next) => {
  try {
    const {
      cageCode,
      page    = '1',
      limit   = '50',
      sortBy  = 'award_date',
      sortDir = 'DESC',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    // Whitelist sortable columns to prevent SQL injection
    const allowedSortCols = new Set([
      'award_date', 'award_amount', 'cage_code', 'company_name',
      'contract_number', 'dla_office',
    ]);
    const col = allowedSortCols.has(sortBy) ? sortBy : 'award_date';
    const dir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const values     = [];

    if (cageCode) {
      values.push(cageCode);
      conditions.push(`a.cage_code = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        a.id,
        a.cage_code,
        c.company_name,
        a.contract_number,
        a.award_amount,
        a.award_date,
        a.dla_office,
        a.description,
        a.created_at
      FROM awards a
      JOIN companies c ON c.cage_code = a.cage_code
      ${where}
      ORDER BY ${col} ${dir}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM awards a
      JOIN companies c ON c.cage_code = a.cage_code
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...values, limitNum, offset]),
      db.query(countQuery, values),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data:       dataResult.rows,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/awards/:cageCode
router.get('/:cageCode', async (req, res, next) => {
  try {
    const { cageCode } = req.params;
    const {
      page    = '1',
      limit   = '50',
      sortBy  = 'award_date',
      sortDir = 'DESC',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    const allowedSortCols = new Set([
      'award_date', 'award_amount', 'contract_number', 'dla_office',
    ]);
    const col = allowedSortCols.has(sortBy) ? sortBy : 'award_date';
    const dir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [dataResult, countResult, companyResult] = await Promise.all([
      db.query(
        `SELECT a.*, c.company_name
         FROM awards a
         JOIN companies c ON c.cage_code = a.cage_code
         WHERE a.cage_code = $1
         ORDER BY ${col} ${dir}
         LIMIT $2 OFFSET $3`,
        [cageCode, limitNum, offset],
      ),
      db.query(
        'SELECT COUNT(*) AS total FROM awards WHERE cage_code = $1',
        [cageCode],
      ),
      db.query(
        'SELECT * FROM companies WHERE cage_code = $1',
        [cageCode],
      ),
    ]);

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: `CAGE code ${cageCode} not found` });
    }

    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      company:    companyResult.rows[0],
      data:       dataResult.rows,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
