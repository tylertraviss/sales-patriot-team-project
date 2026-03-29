const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const logger = require('../logger');
const { createHttpError } = require('../utils/http');

// GET /api/companies
// Query params: search (name or cage_code), page, limit
router.get('/', async (req, res, next) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const values = [];
    const conditions = [];

    if (search) {
      const term = `%${search.trim()}%`;
      values.push(term, search.trim().toUpperCase());
      conditions.push(`(company_name ILIKE $1 OR cage_code = $2)`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        cage_code,
        company_name,
        award_count,
        total_obligated_amount AS total_award_amount,
        first_award_date,
        last_award_date,
        latest_fiscal_year,
        latest_year_obligated_amount,
        yoy_growth_pct
      FROM cage_code_investment_summary
      ${where}
      ORDER BY company_name ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM cage_code_investment_summary
      ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...values, limitNum, offset]),
      db.query(countQuery, values),
    ]);

    const total = Number.parseInt(countResult.rows[0].total, 10);

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

// GET /api/companies/:cageCode
router.get('/:cageCode', async (req, res, next) => {
  try {
    const { cageCode } = req.params;
    const result = await db.query(
      `SELECT
         cage_code,
         company_name,
         uei,
         award_count,
         contract_count,
         total_obligated_amount AS total_award_amount,
         total_contract_value,
         avg_award_amount,
         distinct_contracting_agencies,
         distinct_naics_codes,
         distinct_performance_states,
         first_award_date,
         last_award_date,
         latest_fiscal_year,
         latest_year_obligated_amount,
         previous_year_obligated_amount,
         yoy_growth_pct
       FROM cage_code_investment_summary
       WHERE cage_code = $1`,
      [cageCode.toUpperCase()],
    );

    if (result.rows.length === 0) {
      logger.warn('company not found', { requestId: req.id, cageCode });
      throw createHttpError(404, `Company with CAGE code ${cageCode} not found`);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
