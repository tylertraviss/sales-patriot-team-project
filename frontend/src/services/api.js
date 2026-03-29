import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardKPIs(params = {}) {
  const { data } = await api.get('/dashboard/kpis', { params });
  return data;
}

export async function getTopEarners(params = {}) {
  const { data } = await api.get('/dashboard/top-earners', { params });
  return data.data;
}

export async function getSpendingByState(params = {}) {
  const { data } = await api.get('/dashboard/by-state', { params });
  return data.data;
}

export async function getAwardTypeBreakdown(params = {}) {
  const { data } = await api.get('/dashboard/by-type', { params });
  return data.data;
}

export async function getTopNaics(params = {}) {
  const { data } = await api.get('/dashboard/by-naics', { params });
  return data.data;
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

export async function getAwardHeaders() {
  const { data } = await api.get('/awards/headers');
  return data.headers;
}

/**
 * Fetch paginated awards with optional filters.
 * @param {object} params - { page, limit, sort, order, year, agencyCode, naicsCode, stateCode, ... }
 */
export async function getAwards(params = {}) {
  const { data } = await api.get('/awards', { params });
  return data; // { data, pagination }
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

/**
 * Search / list vendors.
 * @param {object} params - { search, state_code, naics_code, agency_code, set_aside_code, year, page, limit, sort, order }
 */
export async function getVendors(params = {}) {
  const { data } = await api.get('/vendors', { params });
  return data; // { data, pagination }
}

/**
 * Fetch a single vendor by CAGE code.
 */
export async function getVendor(cageCode) {
  const { data } = await api.get(`/vendors/${cageCode}`);
  return data;
}

/**
 * Fetch awards for a specific vendor by CAGE code.
 */
export async function getVendorAwards(cageCode, params = {}) {
  const { data } = await api.get(`/vendors/${cageCode}/awards`, { params });
  return data;
}

/**
 * Fetch award summary (by year, agency, competition) for a vendor by CAGE code.
 */
export async function getVendorSummary(cageCode) {
  const { data } = await api.get(`/vendors/${cageCode}/awards/summary`);
  return data;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadCSV(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
    },
    timeout: 10 * 60 * 1000,
  });
  return data;
}

export default api;
