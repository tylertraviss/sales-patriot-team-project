import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function toCamelDeep(value) {
  if (Array.isArray(value)) {
    return value.map(toCamelDeep);
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [snakeToCamel(key), toCamelDeep(nested)])
    );
  }

  return value;
}

async function get(path, params = {}) {
  const { data } = await api.get(path, { params: cleanParams(params) });
  return toCamelDeep(data);
}

// Dashboard
export async function getDashboardKPIs(params = {}) {
  return get('/dashboard/kpis', params);
}

export async function getTopEarners(params = {}) {
  const data = await get('/dashboard/top-earners', params);
  return data.data ?? [];
}

export async function getSpendingByState(params = {}) {
  const data = await get('/dashboard/by-state', params);
  return data.data ?? [];
}

export async function getAwardTypeBreakdown(params = {}) {
  const data = await get('/dashboard/by-type', params);
  return data.data ?? [];
}

export async function getTopNaics(params = {}) {
  const data = await get('/dashboard/by-naics', params);
  return data.data ?? [];
}

// Awards
export async function getAwardHeaders() {
  const data = await get('/awards/headers');
  return data.headers ?? [];
}

export async function getAwards(params = {}) {
  return get('/awards', params);
}

// Vendors
export async function getVendors(params = {}) {
  return get('/vendors', params);
}

export async function getVendor(identifier) {
  return get(`/vendors/${identifier}`);
}

export async function getVendorById(vendorId) {
  return get(`/vendors/id/${vendorId}`);
}

export async function getVendorAwards(identifier, params = {}) {
  return get(`/vendors/${identifier}/awards`, params);
}

export async function getVendorAwardsById(vendorId, params = {}) {
  return get(`/vendors/id/${vendorId}/awards`, params);
}

export async function getVendorSummary(identifier) {
  return get(`/vendors/${identifier}/awards/summary`);
}

export async function getVendorSummaryById(vendorId) {
  return get(`/vendors/id/${vendorId}/awards/summary`);
}

// Upload
export async function uploadCSV(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
    timeout: 10 * 60 * 1000,
  });

  return toCamelDeep(data);
}

// Analytics
export async function getAnalyticsFilters() {
  return get('/analytics/filters');
}

export async function getOpportunityHeatmap(params = {}) {
  return get('/analytics/opportunity-heatmap', params);
}

export async function getInvestmentScores(params = {}) {
  return get('/analytics/investment-scores', params);
}

export async function getEmergingWinners(params = {}) {
  return get('/analytics/emerging-winners', params);
}

export async function getVendorMoat(params = {}) {
  return get('/analytics/vendor-moat', params);
}

export async function getVendorRiskProfileById(vendorId, params = {}) {
  return get(`/analytics/risk-profile/vendor/${vendorId}`, params);
}

export async function getRiskProfile(identifier, params = {}) {
  return get(`/analytics/risk-profile/${identifier}`, params);
}

export async function getSoleSourceOpportunities(params = {}) {
  return get('/analytics/sole-source-opportunities', params);
}

export async function getMarketConcentration(params = {}) {
  return get('/analytics/market-concentration', params);
}

export async function getSectorHeatmap(params = {}) {
  return get('/analytics/sector-heatmap', params);
}

export async function getGeographicClustering(params = {}) {
  return get('/analytics/geographic-clustering', params);
}

export async function getNaicsTrends(params = {}) {
  return get('/analytics/naics-trends', params);
}

export async function getRepeatWinners(params = {}) {
  return get('/analytics/repeat-winners', params);
}

export async function getRevenueStabilityById(vendorId, params = {}) {
  return get(`/analytics/revenue-stability/vendor/${vendorId}`, params);
}

export async function getWinRate(identifier, params = {}) {
  return get(`/analytics/win-rate/${identifier}`, params);
}

export default api;
