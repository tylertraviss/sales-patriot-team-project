import {
  mockGetVendor,
  mockGetVendorSummary,
  mockGetVendorAwards,
} from './mockApi';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'false';

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** GET /api/vendors/:uei — single vendor profile */
export function getVendor(uei) {
  if (USE_MOCK) return mockGetVendor(uei);
  return apiFetch(`/vendors/${uei}`);
}

/**
 * GET /api/vendors/:uei/awards/summary
 * Returns aggregate breakdown: by year, agency, NAICS, competition, etc.
 */
export function getVendorSummary(uei) {
  if (USE_MOCK) return mockGetVendorSummary(uei);
  return apiFetch(`/vendors/${uei}/awards/summary`);
}

/**
 * GET /api/vendors/:uei/awards
 * Paginated list of individual contracts.
 */
export function getVendorAwards(uei, params = {}) {
  if (USE_MOCK) return mockGetVendorAwards(uei, params);
  return apiFetch(`/vendors/${uei}/awards`, params);
}
