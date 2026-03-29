import { useState, useEffect, useCallback, useRef } from 'react';
import VendorsFilters from '@/components/VendorsFilters';
import VendorsTable from '@/components/VendorsTable';
import VendorsPagination from '@/components/VendorsPagination';
import { getApiErrorMessage } from '@/lib/apiError';

const DEFAULT_FILTERS = {
  search: '',
  year: '2010',
  stateCode: '',
  naicsCode: '',
  agencyCode: '',
  setAsideType: '',
};

const DEFAULT_SORT = { sort: 'total_obligated', order: 'desc' };
const DEFAULT_PAGE = { page: 1, limit: 25 };

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function Vendors() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [pagination, setPagination] = useState(DEFAULT_PAGE);

  // Separate state for the debounced search value
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  const [data, setData] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      // Reset to page 1 when search changes
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [filters.search]);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page);
      params.set('limit', pagination.limit);
      params.set('sort', sort.sort);
      params.set('order', sort.order);
      if (filters.year) params.set('year', filters.year);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.stateCode) params.set('state_code', filters.stateCode);
      if (filters.naicsCode) params.set('naics_code', filters.naicsCode);
      if (filters.agencyCode) params.set('agency_code', filters.agencyCode);
      if (filters.setAsideType) params.set('set_aside_type', filters.setAsideType);

      const res = await fetch(`${BASE_URL}/vendors?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `Server error: ${res.status} ${res.statusText}`);
      }
      setData(json.data ?? []);
      setPaginationMeta(json.pagination ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load vendors.'));
      setData([]);
      setPaginationMeta(null);
    } finally {
      setLoading(false);
    }
  }, [pagination, sort, filters.year, filters.stateCode, filters.naicsCode, filters.agencyCode, filters.setAsideType, debouncedSearch]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // Reset page for non-search filter changes (search is handled by debounce effect)
    if (key !== 'search') {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
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

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse top vendors by total obligated contract awards.
        </p>
      </div>

      {/* Filters */}
      <VendorsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Table */}
      <VendorsTable
        data={data}
        loading={loading}
        error={error}
        sort={sort}
        onSort={handleSort}
        onRetry={fetchVendors}
        limit={pagination.limit}
      />

      {/* Pagination */}
      {paginationMeta && (
        <VendorsPagination
          pagination={paginationMeta}
          limit={pagination.limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}
    </div>
  );
}
