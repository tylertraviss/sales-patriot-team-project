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
          contracting_agency_code   AS "code",
          contracting_agency_name   AS "name",
          COUNT(*)                  AS "awardCount",
          SUM(award_amount)         AS "totalObligated"
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
          a.modification_number                             AS "modificationNumber",
          a.award_amount                                    AS "dollarsObligated",
          a.award_date                                      AS "awardDate",
          a.date_signed                                     AS "dateSigned",
          a.award_type_description                          AS "awardType",
          a.naics_code                                      AS "naicsCode",
          a.naics_description                               AS "naicsDescription",
          a.place_of_performance_state_code                 AS "stateCode",
          a.set_aside_code                                  AS "setAsideCode",
          a.extent_competed_code                            AS "extentCompetedCode",
          a.description_of_requirement                      AS "description",
          v.cage_code                                       AS "vendorCage",
          v.vendor_name                                     AS "vendorName"
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
          v.cage_code                                       AS "cageCode",
          v.uei,
          v.vendor_name                                     AS "name",
          v.state_code                                      AS "stateCode",
          v.socio_economic_indicator                        AS "socioEconomicIndicator",
          COUNT(*)                                          AS "awardCount",
          SUM(a.award_amount)                               AS "totalObligated"
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.contracting_agency_code = $1
        GROUP BY v.cage_code, v.uei, v.vendor_name, v.state_code, v.socio_economic_indicator
        ORDER BY ${col} ${dir}
        LIMIT $2 OFFSET $3
      `, [code, l, offset]),
      db.query(`
        SELECT COUNT(DISTINCT v.vendor_id) AS total
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.contracting_agency_code = $1
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
