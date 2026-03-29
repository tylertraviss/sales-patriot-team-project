import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { LayoutList, Globe2, Loader2 } from 'lucide-react';
import VendorsFilters from '@/components/VendorsFilters';
import VendorsTable from '@/components/VendorsTable';
import VendorsPagination from '@/components/VendorsPagination';
import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import { mockGetVendors } from '@/services/mockApi';
import { cn } from '@/lib/utils';

// Lazy-load the globe so Three.js (~2MB) only downloads when the user switches to globe view
const VendorGlobe = lazy(() => import('@/components/VendorGlobe'));

const DEFAULT_FILTERS = {
  search: '',
  year: '2010',
  stateCode: '',
  naicsCode: '',
  agencyCode: '',
  setAsideType: '',
};

const DEFAULT_SORT = { sort: 'totalObligated', order: 'desc' };
const DEFAULT_PAGE = { page: 1, limit: 25 };

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

// Fetch ALL vendors (no pagination) for the globe — we need every pin
const GLOBE_LIMIT = 500;

export default function Vendors() {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'globe'

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [pagination, setPagination] = useState(DEFAULT_PAGE);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  const [data, setData] = useState([]);
  const [allVendors, setAllVendors] = useState([]); // for globe — all vendors, unfiltered
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Drawer state
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [filters.search]);

  // Fetch paginated table data
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let json;
      if (USE_MOCK) {
        json = await mockGetVendors({
          page: pagination.page,
          limit: pagination.limit,
          sort: sort.sort,
          order: sort.order,
          year: filters.year,
          search: debouncedSearch,
          stateCode: filters.stateCode,
          naicsCode: filters.naicsCode,
          agencyCode: filters.agencyCode,
          setAsideType: filters.setAsideType,
        });
      } else {
        const params = new URLSearchParams();
        params.set('page', pagination.page);
        params.set('limit', pagination.limit);
        params.set('sort', sort.sort);
        params.set('order', sort.order);
        if (filters.year) params.set('year', filters.year);
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (filters.stateCode) params.set('stateCode', filters.stateCode);
        if (filters.naicsCode) params.set('naicsCode', filters.naicsCode);
        if (filters.agencyCode) params.set('agencyCode', filters.agencyCode);
        if (filters.setAsideType) params.set('setAsideType', filters.setAsideType);
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

  // Fetch all vendors for globe (once, unfiltered, high limit)
  useEffect(() => {
    async function loadAll() {
      try {
        const json = USE_MOCK
          ? await mockGetVendors({ page: 1, limit: GLOBE_LIMIT, sort: 'totalObligated', order: 'desc' })
          : await fetch(`${BASE_URL}/vendors?page=1&limit=${GLOBE_LIMIT}&sort=totalObligated&order=desc`)
              .then((r) => r.json());
        setAllVendors(json.data ?? []);
      } catch { /* silent — globe just shows fewer pins */ }
    }
    loadAll();
  }, []); // only on mount

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
      sort: column,
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
    setSelectedVendor(row);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header + view toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse top vendors by total obligated contract awards.
          </p>
        </div>

        {/* Segmented toggle */}
        <div className="flex items-center rounded-lg border bg-muted p-1 gap-1 shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'table'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutList className="h-4 w-4" />
            Table
          </button>
          <button
            onClick={() => setViewMode('globe')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'globe'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Globe2 className="h-4 w-4" />
            Globe
          </button>
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
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

      {/* ── GLOBE VIEW ── */}
      {viewMode === 'globe' && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[480px] rounded-xl bg-[#080d1a]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }>
          <VendorGlobe
            vendors={allVendors.length ? allVendors : data}
            onVendorClick={handleRowClick}
          />
        </Suspense>
      )}

      {/* Vendor detail drawer — shared between both views */}
      <VendorDetailDrawer
        uei={selectedVendor?.uei}
        vendorName={selectedVendor?.vendorName}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
