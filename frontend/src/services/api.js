import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

/**
 * Fetch the column definitions from the backend.
 * Returns: { headers: Array<{ key, label, type }> }
 */
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

/**
 * Upload a CSV file.
 * @param {File} file - The File object from the file input
 * @param {function} onProgress - Progress callback: (percentComplete: number) => void
 */
export async function uploadCSV(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
    timeout: 10 * 60 * 1000,
  });

  return data;
}

export default api;
