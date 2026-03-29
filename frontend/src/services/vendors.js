import {
  mockGetVendor,
  mockGetVendorSummary,
  mockGetVendorAwards,
} from './mockApi';
import {
  getVendor as apiGetVendor,
  getVendorById as apiGetVendorById,
  getVendorSummary as apiGetVendorSummary,
  getVendorSummaryById as apiGetVendorSummaryById,
  getVendorAwards as apiGetVendorAwards,
  getVendorAwardsById as apiGetVendorAwardsById,
  getWinRate as apiGetWinRate,
} from './api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

/** GET /api/vendors/:cage_code — single vendor profile */
export function getVendor(cageCode) {
  if (USE_MOCK) return mockGetVendor(cageCode);
  return apiGetVendor(cageCode);
}

export function getVendorById(vendorId) {
  return apiGetVendorById(vendorId);
}

/**
 * GET /api/vendors/:cage_code/awards/summary
 * Returns aggregate breakdown: by year, agency, competition, etc.
 */
export function getVendorSummary(cageCode) {
  if (USE_MOCK) return mockGetVendorSummary(cageCode);
  return apiGetVendorSummary(cageCode);
}

export function getVendorSummaryById(vendorId) {
  return apiGetVendorSummaryById(vendorId);
}

/**
 * GET /api/vendors/:cage_code/awards
 * Paginated list of individual contracts.
 */
export function getVendorAwards(cageCode, params = {}) {
  if (USE_MOCK) return mockGetVendorAwards(cageCode, params);
  return apiGetVendorAwards(cageCode, params);
}

export function getVendorAwardsById(vendorId, params = {}) {
  return apiGetVendorAwardsById(vendorId, params);
}

/**
 * GET /api/analytics/win-rate/:cage_code
 * Competitive win rate, sole source split, set-aside history.
 */
export function getWinRate(cageCode, params = {}) {
  // No mock implementation — always hit real API
  return apiGetWinRate(cageCode, params);
}
