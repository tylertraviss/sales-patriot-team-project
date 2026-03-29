require('dotenv').config();

const BASE_URL = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;

async function getJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`);
  if (!response.ok) {
    throw new Error(`${pathname} -> ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const filters = await getJson('/api/analytics/filters');
  assert(Array.isArray(filters.years), 'filters.years should be an array');

  const heatmap = await getJson('/api/analytics/opportunity-heatmap?limit=1');
  const emerging = await getJson('/api/analytics/emerging-winners?limit=2');
  const moat = await getJson('/api/analytics/vendor-moat?limit=2');
  const soleSource = await getJson('/api/analytics/sole-source-opportunities?group_by=agency&limit=2');
  const market = await getJson('/api/analytics/market-concentration?group_by=naics&limit=2');
  const geographic = await getJson('/api/analytics/geographic-clustering?limit=2');
  const naicsTrends = await getJson('/api/analytics/naics-trends?top_n=2');
  const repeatWinners = await getJson('/api/analytics/repeat-winners');
  const vendors = await getJson('/api/vendors?limit=1');

  assert(Array.isArray(heatmap.data), 'opportunity heatmap should return data array');
  assert(Array.isArray(emerging.data), 'emerging winners should return data array');
  assert(Array.isArray(moat.data), 'vendor moat should return data array');
  assert(Array.isArray(soleSource.data), 'sole-source opportunities should return data array');
  assert(Array.isArray(market.data), 'market concentration should return data array');
  assert(Array.isArray(geographic.data), 'geographic clustering should return data array');
  assert(Array.isArray(naicsTrends.data), 'naics trends should return data array');
  assert(Array.isArray(repeatWinners.data), 'repeat winners should return data array');
  assert(Array.isArray(vendors.data), 'vendors should return data array');

  let vendorSpecific = { skipped: true };
  if (vendors.data.length > 0) {
    const vendorId = vendors.data[0].vendorId;
    const vendor = await getJson(`/api/vendors/id/${vendorId}`);
    const vendorAwards = await getJson(`/api/vendors/id/${vendorId}/awards?limit=1`);
    const vendorSummary = await getJson(`/api/vendors/id/${vendorId}/awards/summary`);
    const risk = await getJson(`/api/analytics/risk-profile/vendor/${vendorId}`);
    const revenue = await getJson(`/api/analytics/revenue-stability/vendor/${vendorId}`);

    assert(vendor.vendorId === vendorId, 'vendor detail should return the requested vendor');
    assert(Array.isArray(vendorAwards.data), 'vendor awards should return data array');
    assert(Array.isArray(vendorSummary.byYear), 'vendor summary should return byYear');
    assert(Array.isArray(risk.topAgencies), 'risk profile should return top agencies');
    assert(Array.isArray(revenue.data), 'revenue stability should return data array');

    vendorSpecific = { skipped: false, vendorId };
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    vendorSpecific,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
