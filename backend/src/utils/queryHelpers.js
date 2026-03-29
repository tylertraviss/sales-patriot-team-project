/**
 * Shared query helpers used across route files.
 *
 * Centralising these prevents copy-paste drift and makes it easy to change
 * DB behaviour (e.g. fiscal-year fallback logic) in one place.
 */

/**
 * Normalise page / limit query params and calculate the SQL OFFSET.
 *
 * @param {string|number} page  - 1-based page number (defaults to 1)
 * @param {string|number} limit - rows per page, capped at 100 (defaults to 25)
 * @returns {{ page: number, limit: number, offset: number }}
 */
function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  return { page: p, limit: l, offset: (p - 1) * l };
}

/**
 * Returns a SQL expression that resolves a row's fiscal year from whichever
 * column is populated, falling back through award_date / date_signed /
 * reveal_date if the explicit fiscal-year columns are NULL.
 *
 * Many DLA records have NULL award_fiscal_year / contract_fiscal_year, so the
 * date fallback is essential for accurate year-over-year grouping.
 *
 * @param {string} alias - SQL table alias (default 'a')
 * @returns {string} SQL COALESCE expression
 */
function fiscalYearExpr(alias = 'a') {
  return `COALESCE(${alias}.award_fiscal_year, ${alias}.contract_fiscal_year, EXTRACT(YEAR FROM COALESCE(${alias}.award_date, ${alias}.date_signed, ${alias}.reveal_date))::INT)`;
}

module.exports = { paginate, fiscalYearExpr };
