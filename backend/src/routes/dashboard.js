const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const logger  = require('../logger');

// GET /api/dashboard/kpis
// Returns top-level KPI numbers for the banner
router.get('/kpis', async (req, res, next) => {
  try {
    const { year } = req.query;
    const values = [];
    const yearFilter = year ? `WHERE award_fiscal_year = $${values.push(parseInt(year))}` : '';

    const result = await db.query(`
      SELECT
        COALESCE(SUM(award_amount), 0)                                                    AS total_obligated,
        COUNT(*)                                                                           AS total_awards,
        COUNT(DISTINCT vendor_id)                                                          AS total_vendors,
        ROUND(
          COUNT(*) FILTER (WHERE extent_competed_code = 'D') * 100.0 / NULLIF(COUNT(*), 0), 1
        )                                                                                  AS sole_source_rate
      FROM award_transactions
      ${yearFilter}
    `, values);

    logger.info('kpis served', { requestId: req.id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/top-earners
// Top 10 vendors by total award amount
router.get('/top-earners', async (req, res, next) => {
  try {
    const { year, agencyCode, extentCompeted, awardType } = req.query;
    const values = [];
    const conditions = [];

    if (year)           conditions.push(`at.award_fiscal_year = $${values.push(parseInt(year))}`);
    if (agencyCode)     conditions.push(`at.contracting_agency_code = $${values.push(agencyCode)}`);
    if (extentCompeted) conditions.push(`at.extent_competed_code = $${values.push(extentCompeted)}`);
    if (awardType)      conditions.push(`at.award_type_description = $${values.push(awardType)}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT
        ve.vendor_name,
        ve.cage_code,
        ve.uei,
        COALESCE(SUM(at.award_amount), 0) AS total_obligated,
        COUNT(*)                           AS award_count
      FROM award_transactions at
      JOIN vendor_entities ve ON ve.vendor_id = at.vendor_id
      ${where}
      GROUP BY ve.vendor_id, ve.vendor_name, ve.cage_code, ve.uei
      ORDER BY total_obligated DESC
      LIMIT 10
    `, values);

    logger.info('top-earners served', { requestId: req.id, count: result.rows.length });
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-state
// Total obligated grouped by place of performance state
router.get('/by-state', async (req, res, next) => {
  try {
    const { year } = req.query;
    const values = [];
    const yearFilter = year ? `WHERE award_fiscal_year = $${values.push(parseInt(year))}` : '';

    const result = await db.query(`
      SELECT
        place_of_performance_state_code  AS state,
        COALESCE(SUM(award_amount), 0)   AS total_obligated
      FROM award_transactions
      ${yearFilter}
      GROUP BY place_of_performance_state_code
      ORDER BY total_obligated DESC
      LIMIT 10
    `, values);

    logger.info('by-state served', { requestId: req.id });
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-type
// Total obligated grouped by award type
router.get('/by-type', async (req, res, next) => {
  try {
    const { year } = req.query;
    const values = [];
    const yearFilter = year ? `WHERE award_fiscal_year = $${values.push(parseInt(year))}` : '';

    const result = await db.query(`
      SELECT
        award_type_description           AS name,
        COALESCE(SUM(award_amount), 0)   AS value
      FROM award_transactions
      ${yearFilter}
      GROUP BY award_type_description
      ORDER BY value DESC
    `, values);

    logger.info('by-type served', { requestId: req.id });
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-naics
// Top industries by total obligated
router.get('/by-naics', async (req, res, next) => {
  try {
    const { year } = req.query;
    const values = [];
    const yearFilter = year ? `WHERE award_fiscal_year = $${values.push(parseInt(year))}` : '';

    const result = await db.query(`
      SELECT
        naics_code                        AS code,
        naics_description                 AS name,
        COALESCE(SUM(award_amount), 0)    AS total_obligated,
        COUNT(*)                          AS award_count
      FROM award_transactions
      ${yearFilter}
      GROUP BY naics_code, naics_description
      ORDER BY total_obligated DESC
      LIMIT 8
    `, values);

    logger.info('by-naics served', { requestId: req.id });
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
