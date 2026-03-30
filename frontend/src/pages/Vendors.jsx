import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { LayoutList, Globe2, Loader2 } from 'lucide-react';
import VendorsFilters from '@/components/VendorsFilters';
import VendorsTable from '@/components/VendorsTable';
import VendorsPagination from '@/components/VendorsPagination';
import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import { mockGetVendors } from '@/services/mockApi';
import { cn } from '@/lib/utils';
import { getParam, setParams } from '@/hooks/useUrlState';

const VendorGlobe = lazy(() => import('@/components/VendorGlobe'));

// ── URL param keys ────────────────────────────────────────────────────────────
const P = {
  view:       'view',
  search:     'search',
  year:       'year',
  state:      'state',
  naics:      'naics',
  agency:     'agency',
  setAside:   'set_aside',
  sort:       'sort',
  order:      'order',
  page:       'page',
  limit:      'limit',
  vendor:     'vendor',
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  search: '', year: '', stateCode: '', naicsCode: '', agencyCode: '', setAsideType: '',
};
const DEFAULT_SORT = { sort: 'totalObligated', order: 'desc' };
const DEFAULT_PAGE = { page: 1, limit: 25 };

// ── Read initial state from URL ───────────────────────────────────────────────
function readUrlState() {
  return {
    viewMode:   getParam(P.view, 'table') === 'map' ? 'table' : getParam(P.view, 'table'),
    filters: {
      search:       getParam(P.search,  ''),
      year:         getParam(P.year,    ''),
      stateCode:    getParam(P.state,   ''),
      naicsCode:    getParam(P.naics,   ''),
      agencyCode:   getParam(P.agency,  ''),
      setAsideType: getParam(P.setAside,''),
    },
    sort: {
      sort:  getParam(P.sort,  DEFAULT_SORT.sort),
      order: getParam(P.order, DEFAULT_SORT.order),
    },
    pagination: {
      page:  parseInt(getParam(P.page,  '1'), 10)  || 1,
      limit: parseInt(getParam(P.limit, '25'), 10) || 25,
    },
    vendorId: getParam(P.vendor, ''),
  };
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const GLOBE_PAGE_SIZE = 100;
const GLOBE_MAX_PAGES = 20;

export default function Vendors() {
  const init = readUrlState();

  const [viewMode,    setViewModeRaw]  = useState(init.viewMode);
  const [filters,     setFilters]      = useState(init.filters);
  const [sort,        setSort]         = useState(init.sort);
  const [pagination,  setPagination]   = useState(init.pagination);

  const [debouncedSearch, setDebouncedSearch] = useState(init.filters.search);
  const debounceRef = useRef(null);

  const [data,            setData]           = useState([]);
  const [allVendors,      setAllVendors]      = useState([]);
  const [allVendorsTotal, setAllVendorsTotal] = useState(0);
  const [globeLoading,    setGlobeLoading]    = useState(false);
  const [paginationMeta,  setPaginationMeta]  = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  // Drawer — driven by ?vendor= param
  const [selectedVendorId, setSelectedVendorId] = useState(init.vendorId);
  const [selectedVendor,   setSelectedVendor]   = useState(null);
  const [drawerOpen,       setDrawerOpen]        = useState(!!init.vendorId);

  // ── URL sync helpers ────────────────────────────────────────────────────────

  function setViewMode(v) {
    setViewModeRaw(v);
    setParams({ [P.view]: v === 'table' ? '' : v });
  }

  function syncAllToUrl(f, s, pg, vm, vid) {
    setParams({
      [P.view]:     vm === 'table' ? '' : vm,
      [P.search]:   f.search,
      [P.year]:     f.year === '2010' ? '' : f.year,
      [P.state]:    f.stateCode,
      [P.naics]:    f.naicsCode,
      [P.agency]:   f.agencyCode,
      [P.setAside]: f.setAsideType,
      [P.sort]:     s.sort === DEFAULT_SORT.sort   ? '' : s.sort,
      [P.order]:    s.order === DEFAULT_SORT.order ? '' : s.order,
      [P.page]:     pg.page  === 1  ? '' : pg.page,
      [P.limit]:    pg.limit === 25 ? '' : pg.limit,
      [P.vendor]:   vid,
    });
  }

  // Sync URL on every meaningful state change
  useEffect(() => {
    syncAllToUrl(filters, sort, pagination, viewMode, selectedVendorId);
  }, [filters, sort, pagination, viewMode, selectedVendorId]);

  // Sync state when popstate fires (back/forward)
  useEffect(() => {
    const handler = () => {
      const s = readUrlState();
      setViewModeRaw(s.viewMode);
      setFilters(s.filters);
      setDebouncedSearch(s.filters.search);
      setSort(s.sort);
      setPagination(s.pagination);
      setSelectedVendorId(s.vendorId);
      if (!s.vendorId) { setDrawerOpen(false); setSelectedVendor(null); }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [filters.search]);

  // ── Fetch vendors (table) ───────────────────────────────────────────────────
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let json;
      if (USE_MOCK) {
        json = await mockGetVendors({
          page: pagination.page, limit: pagination.limit,
          sort: sort.sort, order: sort.order,
          year: filters.year, search: debouncedSearch,
          stateCode: filters.stateCode, naicsCode: filters.naicsCode,
          agencyCode: filters.agencyCode, setAsideType: filters.setAsideType,
        });
      } else {
        const params = new URLSearchParams();
        params.set('page',  pagination.page);
        params.set('limit', pagination.limit);
        params.set('sort',  sort.sort);
        params.set('order', sort.order);
        if (filters.year)         params.set('year',          filters.year);
        if (debouncedSearch)      params.set('search',         debouncedSearch);
        if (filters.stateCode)    params.set('state_code',     filters.stateCode);
        if (filters.naicsCode)    params.set('naics_code',     filters.naicsCode);
        if (filters.agencyCode)   params.set('agency_code',    filters.agencyCode);
        if (filters.setAsideType) params.set('set_aside_code', filters.setAsideType);
        const res = await fetch(`${BASE_URL}/vendors?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);
        json = await res.json();
      }
      setData(json.data ?? []);
      setPaginationMeta(json.pagination ?? null);
    } catch (err) {
      setError(err.message);
      setData([]);
      setPaginationMeta(null);
    } finally {
      setLoading(false);
    }
  }, [pagination, sort, filters.year, filters.stateCode, filters.naicsCode, filters.agencyCode, filters.setAsideType, debouncedSearch]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // ── After data loads, restore drawer from URL ?vendor= param ───────────────
  useEffect(() => {
    if (!selectedVendorId || loading) return;
    // Find the matching row in current page data
    const match = data.find(
      (r) => r.cageCode === selectedVendorId || r.uei === selectedVendorId
    );
    if (match) {
      setSelectedVendor(match);
      setDrawerOpen(true);
    } else if (selectedVendorId) {
      // Vendor not on this page but ID is valid — open drawer directly by ID
      setSelectedVendor({ cageCode: selectedVendorId, name: '' });
      setDrawerOpen(true);
    }
  }, [data, selectedVendorId, loading]);

  // ── Fetch all vendors for globe ─────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      setGlobeLoading(true);
      try {
        if (USE_MOCK) {
          const json = await mockGetVendors({ page: 1, limit: 500, sort: 'totalObligated', order: 'desc' });
          setAllVendors(json.data ?? []);
          setAllVendorsTotal(json.pagination?.total ?? 0);
          return;
        }
        const first = await fetch(
          `${BASE_URL}/vendors?page=1&limit=${GLOBE_PAGE_SIZE}&sort=totalObligated&order=desc`
        ).then((r) => r.json());
        const total      = first.pagination?.total ?? 0;
        const totalPages = first.pagination?.totalPages ?? 1;
        const pagesToFetch = Math.min(GLOBE_MAX_PAGES, totalPages);
        setAllVendorsTotal(total);
        const restPromises = [];
        for (let p = 2; p <= pagesToFetch; p++) {
          restPromises.push(
            fetch(`${BASE_URL}/vendors?page=${p}&limit=${GLOBE_PAGE_SIZE}&sort=totalObligated&order=desc`)
              .then((r) => r.json()).then((j) => j.data ?? []).catch(() => [])
          );
        }
        const restPages = await Promise.all(restPromises);
        setAllVendors([...(first.data ?? []), ...restPages.flat()]);
      } catch { /* silent */ } finally {
        setGlobeLoading(false);
      }
    }
    loadAll();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key !== 'search') setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
    setPagination(DEFAULT_PAGE);
  }

  function handleSort(column) {
    setSort((prev) => ({
      sort:  column,
      order: prev.sort === column && prev.order === 'asc' ? 'desc' : 'asc',
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handlePageChange(newPage) {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }

  function handleLimitChange(newLimit) {
    setPagination({ page: 1, limit: Number(newLimit) });
  }

  function handleRowClick(row) {
    const id = row.cageCode ?? row.uei ?? '';
    setSelectedVendor(row);
    setSelectedVendorId(id);
    setDrawerOpen(true);
  }

  function handleDrawerClose(open) {
    setDrawerOpen(open);
    if (!open) {
      setSelectedVendorId('');
      setSelectedVendor(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Page header + view toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse vendors by total obligated contract awards.
          </p>
        </div>

        <div className="flex items-center rounded-lg border bg-muted p-1 gap-1 shrink-0">
          {[
            { id: 'table', icon: <LayoutList className="h-4 w-4" />, label: 'Table' },
            { id: 'globe', icon: <Globe2      className="h-4 w-4" />, label: 'Globe' },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <>
          <VendorsFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleReset}
          />
          <VendorsTable
            data={data}
            loading={loading}
            error={error}
            sort={sort}
            onSort={handleSort}
            onRetry={fetchVendors}
            limit={pagination.limit}
            onRowClick={handleRowClick}
            selectedVendorId={selectedVendorId}
          />
          {paginationMeta && (
            <VendorsPagination
              pagination={paginationMeta}
              limit={pagination.limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          )}
        </>
      )}

      {/* GLOBE VIEW */}
      {viewMode === 'globe' && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[480px] rounded-xl bg-[#080d1a]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }>
          <VendorGlobe
            vendors={allVendors.length ? allVendors : data}
            totalVendors={allVendorsTotal}
            loading={globeLoading}
            onVendorClick={handleRowClick}
          />
        </Suspense>
      )}

      {/* Vendor detail drawer */}
      <VendorDetailDrawer
        cageCode={selectedVendor?.cageCode ?? selectedVendor?.uei ?? selectedVendorId}
        vendorName={selectedVendor?.name}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
      />
    </div>
  );
}
