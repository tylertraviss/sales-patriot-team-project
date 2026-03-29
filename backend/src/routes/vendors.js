const express = require('express');

const db = require('../db/connection');
const logger = require('../logger');
const { createHttpError } = require('../utils/http');

const router = express.Router();

const SMALL_BUSINESS_FLAG_SQL = `
  CASE
    WHEN LOWER(COALESCE(v.raw_vendor->>'small_business_flag', '')) IN ('true', 't', '1', 'yes', 'y') THEN TRUE
    WHEN LOWER(COALESCE(v.raw_vendor->>'small_business_flag', '')) IN ('false', 'f', '0', 'no', 'n') THEN FALSE
    WHEN CONCAT_WS(' ', COALESCE(v.business_type_description, ''), COALESCE(v.socio_economic_indicator, '')) ILIKE '%small business%' THEN TRUE
    ELSE FALSE
  END
`;

const PARENT_CAGE_SQL = `NULLIF(v.raw_vendor->>'parent_cage', '')`;

const VENDOR_SORT_COLUMNS = {
  name: 'v.vendor_name',
  annual_revenue: 'v.annual_revenue',
  number_of_employees: 'v.number_of_employees',
  registration_date: 'v.vendor_registration_date',
  award_count: 'COALESCE(ar.award_count, 0)',
  total_obligated: 'COALESCE(ar.total_obligated, 0)',
  awardCount: 'COALESCE(ar.award_count, 0)',
  totalObligated: 'COALESCE(ar.total_obligated, 0)',
};

const AWARD_SORT_COLUMNS = {
  dollars_obligated: 'a.award_amount',
  date_signed: 'COALESCE(a.date_signed, a.award_date, a.reveal_date)',
  award_date: 'COALESCE(a.award_date, a.date_signed, a.reveal_date)',
};

function getQueryParam(query, ...keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return null;
}

function parsePositiveInt(value, fallback, { min = 1, max = 500 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function parseBooleanFilter(value) {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', 't', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', 'f', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  throw createHttpError(400, `Invalid boolean value "${value}"`);
}

function buildAwardFilters(query, values) {
  const conditions = [];

  const year = getQueryParam(query, 'year');
  if (year !== null) {
    const fiscalYear = Number.parseInt(year, 10);
    if (!Number.isFinite(fiscalYear)) {
      throw createHttpError(400, `Invalid year "${year}"`);
    }

    values.push(fiscalYear);
    conditions.push(`
      COALESCE(
        a.award_fiscal_year,
        a.contract_fiscal_year,
        EXTRACT(YEAR FROM COALESCE(a.award_date, a.date_signed, a.reveal_date))::INT
      ) = $${values.length}
    `);
  }

  const agencyCode = getQueryParam(query, 'agency_code', 'agencyCode');
  if (agencyCode !== null) {
    values.push(agencyCode.toUpperCase());
    conditions.push(`a.contracting_agency_code = $${values.length}`);
  }

  const naicsCode = getQueryParam(query, 'naics_code', 'naicsCode');
  if (naicsCode !== null) {
    values.push(naicsCode.toUpperCase());
    conditions.push(`a.naics_code = $${values.length}`);
  }

  const setAsideType = getQueryParam(query, 'set_aside_type', 'setAsideType');
  if (setAsideType !== null) {
    values.push(setAsideType.toUpperCase());
    conditions.push(`(
      UPPER(COALESCE(a.set_aside_code, '')) = $${values.length}
      OR UPPER(COALESCE(a.set_aside_name, '')) = $${values.length}
    )`);
  }

  return conditions;
}

function buildVendorWhereClause(query, values, { requireAwardsMatch = false } = {}) {
  const conditions = [];

  const search = getQueryParam(query, 'search');
  if (search !== null) {
    const likeTerm = `%${search}%`;
    values.push(likeTerm, likeTerm, search.toUpperCase());
    conditions.push(`(
      v.vendor_name ILIKE $${values.length - 2}
      OR COALESCE(v.uei, '') ILIKE $${values.length - 1}
      OR COALESCE(v.cage_code, '') = $${values.length}
    )`);
  }

  const stateCode = getQueryParam(query, 'state_code', 'stateCode');
  if (stateCode !== null) {
    values.push(stateCode.toUpperCase());
    conditions.push(`v.state_code = $${values.length}`);
  }

  const countryCode = getQueryParam(query, 'country_code', 'countryCode');
  if (countryCode !== null) {
    values.push(countryCode.toUpperCase());
    conditions.push(`v.country_code = $${values.length}`);
  }

  const parentCage = getQueryParam(query, 'parent_cage', 'parentCage');
  if (parentCage !== null) {
    values.push(parentCage.toUpperCase());
    conditions.push(`UPPER(COALESCE(${PARENT_CAGE_SQL}, '')) = $${values.length}`);
  }

  const smallBusinessFlagValue = getQueryParam(query, 'small_business_flag', 'smallBusinessFlag');
  if (smallBusinessFlagValue !== null) {
    const smallBusinessFlag = parseBooleanFilter(smallBusinessFlagValue);
    values.push(smallBusinessFlag);
    conditions.push(`(${SMALL_BUSINESS_FLAG_SQL}) = $${values.length}`);
  }

  if (requireAwardsMatch) {
    conditions.push('ar.vendor_id IS NOT NULL');
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

function buildVendorListQueryParts(query) {
  const values = [];
  const awardConditions = buildAwardFilters(query, values);
  const where = buildVendorWhereClause(query, values, { requireAwardsMatch: awardConditions.length > 0 });

  const filteredAwardsWhere = awardConditions.length > 0
    ? `WHERE ${awardConditions.join(' AND ')}`
    : '';

  return {
    values,
    filteredAwardsWhere,
    where,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, { max: 100000 });
    const limit = parsePositiveInt(req.query.limit, 25, { max: 200 });
    const offset = (page - 1) * limit;
    const sortKey = getQueryParam(req.query, 'sort') || 'total_obligated';
    const sortColumn = VENDOR_SORT_COLUMNS[sortKey] || VENDOR_SORT_COLUMNS.total_obligated;
    const order = String(getQueryParam(req.query, 'order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const { values, filteredAwardsWhere, where } = buildVendorListQueryParts(req.query);

    const fromClause = `
      FROM vendor_entities v
      LEFT JOIN (
        SELECT
          a.vendor_id,
          COUNT(*) AS award_count,
          ROUND(COALESCE(SUM(a.award_amount), 0), 2) AS total_obligated
        FROM award_transactions a
        ${filteredAwardsWhere}
        GROUP BY a.vendor_id
      ) ar ON ar.vendor_id = v.vendor_id
      ${where}
    `;

    const dataQuery = `
      SELECT
        v.cage_code,
        v.uei,
        v.vendor_name AS name,
        v.state_code,
        v.country_code,
        ${SMALL_BUSINESS_FLAG_SQL} AS small_business_flag,
        v.annual_revenue,
        v.number_of_employees,
        ${PARENT_CAGE_SQL} AS parent_cage,
        TO_CHAR(v.vendor_registration_date, 'YYYY-MM-DD') AS registration_date,
        COALESCE(ar.award_count, 0)::INT AS award_count,
        COALESCE(ar.total_obligated, 0)::DOUBLE PRECISION AS total_obligated
      ${fromClause}
      ORDER BY ${sortColumn} ${order} NULLS LAST, v.vendor_name ASC, v.vendor_id ASC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      ${fromClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...values, limit, offset]),
      db.query(countQuery, values),
    ]);

    const total = Number.parseInt(countResult.rows[0].total, 10);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:cageCode/awards', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, { max: 100000 });
    const limit = parsePositiveInt(req.query.limit, 25, { max: 200 });
    const offset = (page - 1) * limit;
    const cageCode = String(req.params.cageCode || '').trim().toUpperCase();
    const sortKey = getQueryParam(req.query, 'sort', 'sortBy') || 'date_signed';
    const sortColumn = AWARD_SORT_COLUMNS[sortKey] || AWARD_SORT_COLUMNS.date_signed;
    const order = String(getQueryParam(req.query, 'order', 'sortDir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const vendorResult = await db.query(
      'SELECT cage_code FROM vendor_entities WHERE cage_code = $1 LIMIT 1',
      [cageCode],
    );

    if (vendorResult.rows.length === 0) {
      throw createHttpError(404, `Vendor with CAGE code ${cageCode} not found`);
    }

    const values = [cageCode];
    const awardConditions = buildAwardFilters(req.query, values);
    const where = [
      'v.cage_code = $1',
      ...awardConditions,
    ];

    const dataQuery = `
      SELECT
        a.piid,
        a.modification_number,
        COALESCE(a.award_amount, 0)::DOUBLE PRECISION AS dollars_obligated,
        TO_CHAR(COALESCE(a.date_signed, a.award_date, a.reveal_date), 'YYYY-MM-DD') AS date_signed,
        a.award_type_description AS award_type,
        a.naics_code,
        a.naics_description,
        a.product_service_code,
        a.contracting_agency_code AS agency_code,
        a.contracting_agency_name AS agency_name,
        a.place_of_performance_state_code AS state_code,
        a.set_aside_code AS set_aside_type,
        a.extent_competed_code AS extent_competed,
        v.cage_code AS vendor_cage,
        v.uei AS vendor_uei,
        v.vendor_name AS vendor_name
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${sortColumn} ${order} NULLS LAST, a.award_tx_id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM award_transactions a
      JOIN vendor_entities v ON v.vendor_id = a.vendor_id
      WHERE ${where.join(' AND ')}
    `;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataQuery, [...values, limit, offset]),
      db.query(countQuery, values),
    ]);

    const total = Number.parseInt(countResult.rows[0].total, 10);

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:cageCode', async (req, res, next) => {
  try {
    const cageCode = String(req.params.cageCode || '').trim().toUpperCase();
    const result = await db.query(
      `
        SELECT
          v.cage_code,
          v.uei,
          v.vendor_name AS name,
          v.state_code,
          v.country_code,
          ${SMALL_BUSINESS_FLAG_SQL} AS small_business_flag,
          v.annual_revenue,
          v.number_of_employees,
          ${PARENT_CAGE_SQL} AS parent_cage,
          TO_CHAR(v.vendor_registration_date, 'YYYY-MM-DD') AS registration_date,
          COALESCE(s.award_count, 0)::INT AS award_count,
          COALESCE(s.total_obligated_amount, 0)::DOUBLE PRECISION AS total_obligated
        FROM vendor_entities v
        LEFT JOIN cage_code_investment_summary s ON s.vendor_id = v.vendor_id
        WHERE v.cage_code = $1
        LIMIT 1
      `,
      [cageCode],
    );

    if (result.rows.length === 0) {
      throw createHttpError(404, `Vendor with CAGE code ${cageCode} not found`);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
