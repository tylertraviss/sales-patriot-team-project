import { useState, useEffect, useRef } from 'react';
import { getCompanies } from '../services/api';

/**
 * CompanySearch
 *
 * Provides a debounced search box that queries /api/companies.
 * When the user selects a company the onSelect callback receives
 * the company object { cage_code, company_name, award_count, total_award_amount }.
 *
 * Props:
 *   onSelect {function} - called with the selected company object
 *   placeholder {string}
 */
export default function CompanySearch({ onSelect, placeholder = 'Search by company name or CAGE code…' }) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [selected,  setSelected]  = useState(null);
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getCompanies({ search: query.trim(), limit: 20 });
        setResults(data.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelect(company) {
    setSelected(company);
    setQuery(company.company_name);
    setOpen(false);
    if (onSelect) onSelect(company);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    if (onSelect) onSelect(null);
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 pl-4 pr-10 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {loading && (
          <span className="absolute right-3 text-gray-400 text-xs animate-pulse">Searching…</span>
        )}
        {!loading && query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg
                       max-h-64 overflow-y-auto divide-y divide-gray-100 text-sm">
          {results.map((company) => (
            <li
              key={company.cage_code}
              onMouseDown={() => handleSelect(company)}
              className="flex justify-between items-start gap-2 px-4 py-3 cursor-pointer hover:bg-blue-50"
            >
              <div>
                <p className="font-medium text-gray-900">{company.company_name}</p>
                <p className="text-xs text-gray-500">CAGE: {company.cage_code}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-700">{Number(company.award_count).toLocaleString()} awards</p>
                <p className="text-xs text-green-700 font-medium">{formatCurrency(company.total_award_amount)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-3 text-sm text-gray-500">
          No companies found for "{query}"
        </div>
      )}

      {/* Selected badge */}
      {selected && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 font-medium">
          <span>{selected.cage_code}</span>
          <span className="text-blue-400">·</span>
          <span>{selected.company_name}</span>
          <button onClick={handleClear} className="ml-1 text-blue-500 hover:text-blue-700">×</button>
        </div>
      )}
    </div>
  );
}
