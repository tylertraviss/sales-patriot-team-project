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

export async function getAwards(params = {}) {
  const { data } = await api.get('/awards', { params });
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
