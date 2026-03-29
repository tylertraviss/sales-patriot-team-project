import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
 * Fetch paginated awards, optionally filtered by CAGE code.
 * @param {object} params - { cageCode, page, limit, sortBy, sortDir }
 */
export async function getAwards(params = {}) {
  const { data } = await api.get('/awards', { params });
  return data; // { data, pagination }
}

/**
 * Fetch awards for a specific CAGE code.
 */
export async function getAwardsByCageCode(cageCode, params = {}) {
  const { data } = await api.get(`/awards/${cageCode}`, { params });
  return data;
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

/**
 * Search / list companies.
 * @param {object} params - { search, page, limit }
 */
export async function getCompanies(params = {}) {
  const { data } = await api.get('/companies', { params });
  return data;
}

/**
 * Fetch a single company by CAGE code.
 */
export async function getCompany(cageCode) {
  const { data } = await api.get(`/companies/${cageCode}`);
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
    // Large files need a longer timeout
    timeout: 10 * 60 * 1000, // 10 minutes
  });

  return data;
}

export default api;
