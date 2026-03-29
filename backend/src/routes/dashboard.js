const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

// GET /api/dashboard/kpis
router.get('/kpis', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(a.award_amount)                                              AS total_obligated,
        COUNT(*)                                                         AS total_awards,
        COUNT(DISTINCT a.vendor_id)                                      AS total_vendors,
        ROUND(
          100.0 * SUM(CASE WHEN a.extent_competed_code = 'D' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 1
        )                                                                AS sole_source_rate
      FROM award_transactions a
    `);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/top-earners
router.get('/top-earners', async (req, res, next) => {
  try {
    const { year, awardType, extentCompeted } = req.query;
    const conditions = [];
    const values     = [];

    if (year) {
      values.push(parseInt(year, 10));
      conditions.push(`COALESCE(a.award_fiscal_year, a.contract_fiscal_year) = $${values.length}`);
    }
    if (awardType) {
      values.push(awardType);
      conditions.push(`a.award_type_description ILIKE $${values.length}`);
    }
    if (extentCompeted) {
      values.push(extentCompeted);
      conditions.push(`a.extent_competed_code = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT
        v.vendor_name,
        SUM(a.award_amount)  AS total_obligated,
        COUNT(*)             AS award_count
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      ${where}
      GROUP BY v.vendor_name
      ORDER BY total_obligated DESC
      LIMIT 10
    `, values);

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-state
router.get('/by-state', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        place_of_performance_state_code AS state,
        SUM(award_amount)               AS total_obligated
      FROM award_transactions
      WHERE place_of_performance_state_code IS NOT NULL
      GROUP BY state
      ORDER BY total_obligated DESC
      LIMIT 10
    `);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-type
router.get('/by-type', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(award_type_description, 'Unknown') AS name,
        SUM(award_amount)                           AS value
      FROM award_transactions
      GROUP BY name
      ORDER BY value DESC
      LIMIT 5
    `);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-naics
router.get('/by-naics', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(naics_description, naics_code) AS name,
        SUM(award_amount)                       AS total_obligated
      FROM award_transactions
      WHERE naics_code IS NOT NULL
      GROUP BY name
      ORDER BY total_obligated DESC
      LIMIT 8
    `);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
