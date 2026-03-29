const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

// GET /api/naics
router.get('/', async (req, res, next) => {
  try {
    const { search, sort = 'total_obligated', order = 'desc', page, limit } = req.query;
    const { page: p, limit: l, offset } = paginate(page, limit);

    const ALLOWED = new Set(['total_obligated', 'award_count', 'code', 'description']);
    const col = ALLOWED.has(sort) ? sort : 'total_obligated';
    const dir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [`n.code IS NOT NULL`];
    const values     = [];

    if (search) {
      values.push(search);
      conditions.push(`(n.code ILIKE '%' || $${values.length} || '%' OR n.description ILIKE '%' || $${values.length} || '%')`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT
          n.code,
          n.description                   AS "name",
          COUNT(a.award_tx_id)            AS "awardCount",
          SUM(a.award_amount)             AS "totalObligated"
        FROM naics_codes n
        LEFT JOIN award_transactions a ON a.naics_code = n.code
        ${where}
        GROUP BY n.code, n.description
        ORDER BY ${col} ${dir}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `, [...values, l, offset]),
      db.query(`
        SELECT COUNT(*) AS total FROM naics_codes n ${where}
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

// GET /api/naics/graph — vendor-sector network for the Graph page
router.get('/graph', async (_req, res, next) => {
  try {
    // Top NAICS sectors by award count (limit to keep graph manageable)
    const sectorsResult = await db.query(`
      SELECT
        a.naics_code                                          AS code,
        COALESCE(n.description, a.naics_description, a.naics_code) AS description,
        COUNT(DISTINCT a.vendor_id)                           AS "vendorCount",
        SUM(a.award_amount)                                   AS "totalObligated"
      FROM award_transactions a
      LEFT JOIN naics_codes n ON n.code = a.naics_code
      WHERE a.naics_code IS NOT NULL AND BTRIM(a.naics_code) <> ''
      GROUP BY a.naics_code, COALESCE(n.description, a.naics_description, a.naics_code)
      ORDER BY "vendorCount" DESC
      LIMIT 20
    `);

    const sectorCodes = sectorsResult.rows.map((r) => r.code);
    if (!sectorCodes.length) {
      return res.json({ nodes: [], links: [], sectors: [] });
    }

    // Top vendors per sector (cap at 10 per sector to keep graph size reasonable)
    const vendorsResult = await db.query(`
      SELECT
        v.cage_code,
        v.uei,
        v.vendor_name                                         AS name,
        v.state_code                                          AS "stateCode",
        a.naics_code                                          AS "naicsCode",
        SUM(a.award_amount)                                   AS "totalObligated",
        COUNT(*)                                              AS "awardCount",
        COUNT(*) FILTER (WHERE a.extent_competed_code IN ('G','H','CDO')) AS "soleSourceCount",
        COUNT(*) FILTER (WHERE a.extent_competed_code IN ('A','B','C','D','E','F')) AS "competedCount",
        ROW_NUMBER() OVER (PARTITION BY a.naics_code ORDER BY SUM(a.award_amount) DESC) AS rn
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE a.naics_code = ANY($1)
      GROUP BY v.cage_code, v.uei, v.vendor_name, v.state_code, a.naics_code
    `, [sectorCodes]);

    // Build nodes and links
    const nodes = [];
    const links = [];
    const vendorsSeen = new Set();

    // NAICS sector hub nodes
    for (const s of sectorsResult.rows) {
      nodes.push({
        id:             `naics_${s.code}`,
        type:           'naics',
        naicsCode:      s.code,
        label:          s.description,
        vendorCount:    parseInt(s.vendorCount, 10),
        totalObligated: parseFloat(s.totalObligated) || 0,
      });
    }

    // Vendor nodes + edges (top 10 per sector only)
    for (const row of vendorsResult.rows) {
      if (row.rn > 10) continue;

      const vendorId = `vendor_${row.cage_code || row.uei}`;

      if (!vendorsSeen.has(vendorId)) {
        vendorsSeen.add(vendorId);
        const soleSource = parseInt(row.soleSourceCount, 10);
        const competed   = parseInt(row.competedCount, 10);
        const total      = parseInt(row.awardCount, 10);
        const competition =
          total === 0           ? 'mixed'
          : soleSource / total > 0.6 ? 'sole'
          : competed   / total > 0.6 ? 'competed'
          : 'mixed';

        nodes.push({
          id:             vendorId,
          type:           'vendor',
          cageCode:       row.cage_code || null,
          uei:            row.uei || null,
          label:          row.name,
          stateCode:      row.stateCode,
          totalObligated: parseFloat(row.totalObligated) || 0,
          awardCount:     total,
          competition,
        });
      }

      links.push({
        source: `naics_${row.naicsCode}`,
        target: vendorId,
      });
    }

    const sectors = sectorsResult.rows.map((s) => ({
      code:        s.code,
      description: s.description,
      vendorCount: parseInt(s.vendorCount, 10),
    }));

    res.json({ nodes, links, sectors });
  } catch (err) {
    next(err);
  }
});

// GET /api/naics/:code/awards
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
          a.contracting_agency_code                         AS "agencyCode",
          a.contracting_agency_name                         AS "agencyName",
          a.place_of_performance_state_code                 AS "stateCode",
          a.set_aside_code                                  AS "setAsideCode",
          a.extent_competed_code                            AS "extentCompetedCode",
          a.description_of_requirement                      AS "description",
          v.cage_code                                       AS "vendorCage",
          v.vendor_name                                     AS "vendorName"
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.naics_code = $1
        ORDER BY a.${col} ${dir}
        LIMIT $2 OFFSET $3
      `, [code, l, offset]),
      db.query(
        `SELECT COUNT(*) AS total FROM award_transactions WHERE naics_code = $1`,
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

// GET /api/naics/:code/vendors
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
        WHERE a.naics_code = $1
        GROUP BY v.cage_code, v.uei, v.vendor_name, v.state_code, v.socio_economic_indicator
        ORDER BY ${col} ${dir}
        LIMIT $2 OFFSET $3
      `, [code, l, offset]),
      db.query(`
        SELECT COUNT(DISTINCT v.vendor_id) AS total
        FROM award_transactions a
        JOIN vendor_entities v ON v.vendor_id = a.vendor_id
        WHERE a.naics_code = $1
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
