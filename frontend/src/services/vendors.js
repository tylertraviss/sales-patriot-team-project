import {
  mockGetVendor,
  mockGetVendorSummary,
  mockGetVendorAwards,
} from './mockApi';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** GET /api/vendors/:cage_code */
export function getVendor(cageCode) {
  if (USE_MOCK) return mockGetVendor(cageCode);
  return apiFetch(`/vendors/${cageCode}`);
}

/**
 * GET /api/vendors/:cage_code/awards/summary
 * Backend does not have this endpoint — aggregate client-side from awards list.
 */
export async function getVendorSummary(cageCode) {
  if (USE_MOCK) return mockGetVendorSummary(cageCode);

  const res = await apiFetch(`/vendors/${cageCode}/awards`, { limit: 200, sort: 'award_date', order: 'desc' });
  const awards = res.data ?? [];

  const yearMap        = {};
  const agencyMap      = {};
  const competitionMap = {};
  let totalObligated   = 0;

  for (const a of awards) {
    const amt = Number(a.dollars_obligated ?? 0);
    totalObligated += amt;

    // Derive fiscal year from award_date when no explicit year field
    const year = a.fiscal_year ?? a.award_fiscal_year ??
      (a.award_date ? String(new Date(a.award_date).getFullYear()) : null);
    if (year) {
      if (!yearMap[year]) yearMap[year] = { fiscalYear: year, totalObligated: 0, awardCount: 0 };
      yearMap[year].totalObligated += amt;
      yearMap[year].awardCount    += 1;
    }

    const code = a.agency_code;
    const name = a.agency_name ?? code;
    if (code) {
      if (!agencyMap[code]) agencyMap[code] = { agencyCode: code, agencyName: name, totalObligated: 0, awardCount: 0 };
      agencyMap[code].totalObligated += amt;
      agencyMap[code].awardCount    += 1;
    }

    const ec = a.extent_competed_name ?? a.extent_competed_code ?? 'N/A';
    if (!competitionMap[ec]) competitionMap[ec] = { extentCompeted: ec, count: 0 };
    competitionMap[ec].count += 1;
  }

  return {
    totalObligated,
    awardCount    : awards.length,
    byYear        : Object.values(yearMap).sort((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear)),
    byAgency      : Object.values(agencyMap).sort((a, b) => b.totalObligated - a.totalObligated),
    byCompetition : Object.values(competitionMap),
  };
}

/** GET /api/vendors/:cage_code/awards */
export function getVendorAwards(cageCode, params = {}) {
  if (USE_MOCK) return mockGetVendorAwards(cageCode, params);
  const p = { ...params };
  if (p.sort === 'dollarsObligated') p.sort = 'award_amount';
  return apiFetch(`/vendors/${cageCode}/awards`, p);
}
