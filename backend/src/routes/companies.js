const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const logger  = require('../logger');

// GET /api/companies
// Query params: search (name or cage_code), page, limit
router.get('/', async (req, res, next) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    const values     = [];
    const conditions = [];

    if (search) {
      const term = `%${search}%`;
      values.push(term, search.toUpperCase());
      conditions.push(`(c.company_name ILIKE $1 OR c.cage_code = $2)`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        c.cage_code,
        c.company_name,
        c.created_at,
        COUNT(a.id) AS award_count,
        COALESCE(SUM(a.award_amount), 0) AS total_award_amount
      FROM companies c
      LEFT JOIN awards a ON a.cage_code = c.cage_code
      ${where}
      GROUP BY c.cage_code, c.company_name, c.created_at
      ORDER BY c.company_name ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total FROM companies c ${where}
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

// GET /api/companies/:cageCode
router.get('/:cageCode', async (req, res, next) => {
  try {
    const { cageCode } = req.params;
    const result = await db.query(
      `SELECT
         c.*,
         COUNT(a.id) AS award_count,
         COALESCE(SUM(a.award_amount), 0) AS total_award_amount
       FROM companies c
       LEFT JOIN awards a ON a.cage_code = c.cage_code
       WHERE c.cage_code = $1
       GROUP BY c.cage_code`,
      [cageCode.toUpperCase()],
    );

    if (result.rows.length === 0) {
      logger.warn('company not found', { requestId: req.id, cageCode });
      return res.status(404).json({ error: `Company with CAGE code ${cageCode} not found` });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
