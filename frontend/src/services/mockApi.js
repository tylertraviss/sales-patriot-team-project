/**
 * Mock API — real data extracted from awards_20100314_20100314.csv
 *
 * Enabled when:  VITE_USE_MOCK_API=true  (in .env or .env.local)
 * or when the backend returns a non-OK response and we fall back.
 *
 * Mimics the same envelope shape as the real API:
 *   { data: [...], pagination: { page, limit, total, totalPages } }
 */
import mockData from './mockData.json';

const { vendors, vendorDetails, vendorSummaries, vendorAwards } = mockData;

// Known agency code → full name mapping (from real CSV data)
const AGENCY_NAMES = {
  '9700': 'Dept of Defense',
  '5700': 'Dept of the Air Force',
  '2100': 'Dept of the Army',
  '1700': 'Dept of the Navy',
  '9100': 'Dept of Veterans Affairs',
  '7001': 'Dept of Homeland Security',
  '4700': 'General Services Administration',
  '6900': 'Dept of Transportation',
  '1200': 'Dept of Agriculture',
  '8900': 'Dept of Energy',
};

function resolveAgencyName(code) {
  return AGENCY_NAMES[code?.trim()] ?? code ?? 'Unknown Agency';
}

// Simulate realistic network latency
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

function paginate(arr, page = 1, limit = 25) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.max(1, Math.min(page, totalPages));
  const data = arr.slice((p - 1) * limit, p * limit);
  return { data, pagination: { page: p, limit, total, totalPages } };
}

// ─── GET /api/vendors ────────────────────────────────────────────────────────
export async function mockGetVendors(params = {}) {
  await delay();
  const { page = 1, limit = 25, sort = 'totalObligated', order = 'desc',
          year, search, stateCode, naicsCode, agencyCode, setAsideType } = params;

  let list = [...vendors];

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (v) => v.vendorName.toLowerCase().includes(q) || v.uei.toLowerCase().includes(q)
    );
  }
  if (stateCode) list = list.filter((v) => v.stateCode === stateCode.toUpperCase());
  if (naicsCode) list = list.filter((v) => v.naicsCode.startsWith(naicsCode));
  if (agencyCode) list = list.filter((v) => v.agencyCode === agencyCode);

  // Sort
  const dir = order === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const av = a[sort] ?? 0;
    const bv = b[sort] ?? 0;
    if (typeof av === 'string') return dir * av.localeCompare(bv);
    return dir * (Number(av) - Number(bv));
  });

  return paginate(list, Number(page), Number(limit));
}

// ─── GET /api/vendors/:uei ────────────────────────────────────────────────────
export async function mockGetVendor(uei) {
  await delay();
  const v = vendorDetails[uei];
  if (!v) throw new Error(`Vendor ${uei} not found`);
  return v;
}

// ─── GET /api/vendors/:uei/awards/summary ────────────────────────────────────
export async function mockGetVendorSummary(uei) {
  await delay();
  const s = vendorSummaries[uei];
  if (!s) throw new Error(`Summary for ${uei} not found`);
  // Resolve agency codes to human-readable names
  return {
    ...s,
    byAgency: s.byAgency.map((a) => ({
      ...a,
      agencyName: resolveAgencyName(a.agencyCode),
    })),
  };
}

// ─── GET /api/vendors/:uei/awards ────────────────────────────────────────────
export async function mockGetVendorAwards(uei, params = {}) {
  await delay();
  const { page = 1, limit = 10, sort = 'dollarsObligated', order = 'desc' } = params;
  const list = [...(vendorAwards[uei] ?? [])];

  const dir = order === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const av = a[sort] ?? 0;
    const bv = b[sort] ?? 0;
    if (typeof av === 'string') return dir * av.localeCompare(bv);
    return dir * (Number(av) - Number(bv));
  });

  return paginate(list, Number(page), Number(limit));
}
