import { useEffect, useState, useCallback } from 'react';
import { getAwardHeaders, getAwards } from '../services/api';
import { getApiErrorMessage } from '@/lib/apiError';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function formatCellValue(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    case 'date':
      return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC' });
    default:
      return String(value);
  }
}

/**
 * AwardsTable
 *
 * Fetches column definitions from /api/awards/headers, then renders
 * a fully dynamic, sortable, paginated table of DLA awards.
 *
 * Props:
 *   cageCode {string|null} - optional filter; when set only shows awards for that company
 */
export default function AwardsTable({ cageCode = null }) {
  const [headers,    setHeaders]    = useState([]);
  const [rows,       setRows]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [sortBy,     setSortBy]     = useState('award_date');
  const [sortDir,    setSortDir]    = useState('DESC');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // Fetch column definitions once on mount
  useEffect(() => {
    getAwardHeaders()
      .then(setHeaders)
      .catch((err) => setError(err.message));
  }, []);

  const fetchData = useCallback(async (page, limit, col, dir) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAwards({
        ...(cageCode ? { cageCode } : {}),
        page,
        limit,
        sortBy: col,
        sortDir: dir,
      });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load awards.'));
    } finally {
      setLoading(false);
    }
  }, [cageCode]);

  // Re-fetch whenever sort or cage code changes
  useEffect(() => {
    fetchData(1, pagination.limit, sortBy, sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir, cageCode]);

  function handleSort(key) {
    if (key === sortBy) {
      setSortDir((d) => (d === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortBy(key);
      setSortDir('DESC');
    }
  }

  function handlePageChange(newPage) {
    fetchData(newPage, pagination.limit, sortBy, sortDir);
  }

  function handleLimitChange(e) {
    const newLimit = parseInt(e.target.value, 10);
    fetchData(1, newLimit, sortBy, sortDir);
    setPagination((p) => ({ ...p, limit: newLimit }));
  }

  const sortIcon = (key) => {
    if (key !== sortBy) return null;
    return sortDir === 'DESC' ? ' ▼' : ' ▲';
  };

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
        Error loading awards: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key)}
                  className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
                >
                  {h.label}{sortIcon(h.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-400">
                  No awards found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {headers.map((h) => (
                    <td
                      key={h.key}
                      className={`px-4 py-2 text-gray-800 ${h.type === 'text' ? 'max-w-xs truncate' : 'whitespace-nowrap'}`}
                      title={h.type === 'text' ? row[h.key] ?? '' : undefined}
                    >
                      {formatCellValue(row[h.key], h.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pagination.limit}
            onChange={handleLimitChange}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <span>
          {pagination.total.toLocaleString()} total records
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={pagination.page <= 1 || loading}
            className="rounded px-2 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            «
          </button>
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="rounded px-2 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            ‹
          </button>
          <span className="px-3">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="rounded px-2 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            ›
          </button>
          <button
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="rounded px-2 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
