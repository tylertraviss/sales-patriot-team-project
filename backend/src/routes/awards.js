const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const logger = require('../logger');

const AWARD_HEADERS = [
  { key: 'cage_code', label: 'CAGE Code', type: 'string' },
  { key: 'company_name', label: 'Company Name', type: 'string' },
  { key: 'contract_number', label: 'Contract Number', type: 'string' },
  { key: 'award_amount', label: 'Award Amount', type: 'currency' },
  { key: 'award_date', label: 'Award Date', type: 'date' },
  { key: 'dla_office', label: 'DLA Office', type: 'string' },
  { key: 'description', label: 'Description', type: 'text' },
];

const SORT_COLUMNS = {
  award_date: 'a.award_date',
  award_amount: 'a.award_amount',
  cage_code: 'v.cage_code',
  company_name: 'v.vendor_name',
  contract_number: 'a.contract_number',
  dla_office: 'a.contracting_office_name',
};

// GET /api/awards/headers
router.get('/headers', (req, res) => {
  logger.debug('headers requested', { requestId: req.id });
  res.json({ headers: AWARD_HEADERS });
});

// GET /api/awards
// Query params: cageCode, page, limit, sortBy, sortDir
router.get('/', async (req, res, next) => {
  try {
    const {
      cageCode,
      page = '1',
      limit = '50',
      sortBy = 'award_date',
      sortDir = 'DESC',
    } = req.query;

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;
    const col = SORT_COLUMNS[sortBy] || SORT_COLUMNS.award_date;
    const dir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const values = [];
    const conditions = [];

    if (cageCode) {
      values.push(cageCode.toUpperCase());
      conditions.push(`v.cage_code = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        a.award_tx_id AS id,
        v.cage_code,
        v.vendor_name AS company_name,
        a.contract_number,
        a.award_amount,
        a.award_date,
        a.contracting_office_name AS dla_office,
        a.description_of_requirement AS description,
        a.created_at
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      ${where}
      ORDER BY ${col} ${dir} NULLS LAST, a.award_tx_id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...values, limitNum, offset]),
      db.query(countQuery, values),
    ]);

    const total = Number.parseInt(countResult.rows[0].total, 10);

    logger.info('awards list served', {
      requestId: req.id,
      total,
      page: pageNum,
      limit: limitNum,
      cageCode: cageCode || null,
    });

    res.json({
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
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
      page = '1',
      limit = '50',
      sortBy = 'award_date',
      sortDir = 'DESC',
    } = req.query;

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;
    const col = SORT_COLUMNS[sortBy] || SORT_COLUMNS.award_date;
    const dir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const normalizedCageCode = cageCode.toUpperCase();

    const [dataResult, countResult, companyResult] = await Promise.all([
      db.query(
        `SELECT
           a.award_tx_id AS id,
           v.cage_code,
           v.vendor_name AS company_name,
           a.contract_number,
           a.award_amount,
           a.award_date,
           a.contracting_office_name AS dla_office,
           a.description_of_requirement AS description,
           a.created_at
         FROM award_transactions a
         JOIN vendor_entities v ON v.vendor_id = a.vendor_id
         WHERE v.cage_code = $1
         ORDER BY ${col} ${dir} NULLS LAST, a.award_tx_id DESC
         LIMIT $2 OFFSET $3`,
        [normalizedCageCode, limitNum, offset],
      ),
      db.query(
        `SELECT COUNT(*) AS total
         FROM award_transactions a
         JOIN vendor_entities v ON v.vendor_id = a.vendor_id
         WHERE v.cage_code = $1`,
        [normalizedCageCode],
      ),
      db.query(
        `SELECT
           cage_code,
           company_name,
           uei,
           award_count,
           contract_count,
           total_obligated_amount AS total_award_amount,
           latest_fiscal_year,
           latest_year_obligated_amount,
           yoy_growth_pct
         FROM cage_code_investment_summary
         WHERE cage_code = $1`,
        [normalizedCageCode],
      ),
    ]);

    if (companyResult.rows.length === 0) {
      logger.warn('CAGE code not found', { requestId: req.id, cageCode: normalizedCageCode });
      return res.status(404).json({ error: `CAGE code ${normalizedCageCode} not found` });
    }

    const total = Number.parseInt(countResult.rows[0].total, 10);

    res.json({
      company: companyResult.rows[0],
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
