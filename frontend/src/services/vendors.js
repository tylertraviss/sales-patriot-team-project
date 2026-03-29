import {
  mockGetVendor,
  mockGetVendorSummary,
  mockGetVendorAwards,
} from './mockApi';
import { getVendor as apiGetVendor, getVendorSummary as apiGetVendorSummary, getVendorAwards as apiGetVendorAwards } from './api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

/** GET /api/vendors/:cage_code — single vendor profile */
export function getVendor(cageCode) {
  if (USE_MOCK) return mockGetVendor(cageCode);
  return apiGetVendor(cageCode);
}

/**
 * GET /api/vendors/:cage_code/awards/summary
 * Returns aggregate breakdown: by year, agency, competition, etc.
 */
export function getVendorSummary(cageCode) {
  if (USE_MOCK) return mockGetVendorSummary(cageCode);
  return apiGetVendorSummary(cageCode);
}

/**
 * GET /api/vendors/:cage_code/awards
 * Paginated list of individual contracts.
 */
export function getVendorAwards(cageCode, params = {}) {
  if (USE_MOCK) return mockGetVendorAwards(cageCode, params);
  return apiGetVendorAwards(cageCode, params);
}
