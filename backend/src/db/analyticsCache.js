const MATERIALIZED_VIEWS = [
  'vendor_year_metrics',
  'vendor_investment_summary',
  'cage_code_investment_summary',
];

async function refreshAnalyticsCaches(client) {
  for (const viewName of MATERIALIZED_VIEWS) {
    await client.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
  }
}

module.exports = {
  MATERIALIZED_VIEWS,
  refreshAnalyticsCaches,
};
