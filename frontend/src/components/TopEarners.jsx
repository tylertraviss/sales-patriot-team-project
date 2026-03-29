// Temporary: seeded with real CSV data until backend /api/awards endpoint is wired up.
// Replace MOCK_DATA with: getAwards({ year, agencyCode: 9700, extentCompeted, awardType, sort: 'dollarsObligated', order: 'desc', limit: 10 })

import { useState } from 'react';

const MOCK_DATA = [
  { rank: 1,  vendorName: 'OTIS PRODUCTS, INC',                          dollarsObligated: 22336252 },
  { rank: 2,  vendorName: 'MOOG INC.',                                    dollarsObligated: 9171750  },
  { rank: 3,  vendorName: 'EVERGREEN INTERNATIONAL AIRLINES',             dollarsObligated: 7344887  },
  { rank: 4,  vendorName: 'HARRIS IT SERVICES CORPORATION',               dollarsObligated: 4430384  },
  { rank: 5,  vendorName: 'TOMPCO- TRITON, INC',                         dollarsObligated: 2704000  },
  { rank: 6,  vendorName: 'BIOENGINEERING ARCADIS LIMITED LIABILITY CO',  dollarsObligated: 2602908  },
  { rank: 7,  vendorName: 'INTERNATIONAL BIOMETRIC GROUP, LLC',           dollarsObligated: 2447064  },
  { rank: 8,  vendorName: 'FEDERAL PRISON INDUSTRIES INC',                dollarsObligated: 2239000  },
  { rank: 9,  vendorName: 'FEDERAL EXPRESS CHARTER PROGRAM TEAM',         dollarsObligated: 1688816  },
  { rank: 10, vendorName: 'SPACELINK INTERNATIONAL LLC',                  dollarsObligated: 1688110  },
];

const YEARS = ['N/A', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const AWARD_TYPES = ['N/A', 'DEFINITIVE CONTRACT', 'DELIVERY ORDER', 'PURCHASE ORDER', 'BPA CALL'];
const EXTENT_COMPETED = ['N/A', 'D — Sole Source', 'A — Full & Open', 'B — Not Available'];

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export default function TopEarners() {
  const [year, setYear]           = useState('N/A');
  const [awardType, setAwardType] = useState('N/A');
  const [competed, setCompeted]   = useState('N/A');

  // TODO: when backend is live, replace MOCK_DATA with filtered API call using year/awardType/competed
  const data = MOCK_DATA;
  const max  = data[0]?.dollarsObligated ?? 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      {/* Header + filters */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top 10 Contract Earners</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            This year's top earners, from the biggest agency, with no competition.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <FilterSelect label="Year"        value={year}      onChange={setYear}      options={YEARS}          />
          <FilterSelect label="Award Type"  value={awardType} onChange={setAwardType} options={AWARD_TYPES}    />
          <FilterSelect label="Competed"    value={competed}  onChange={setCompeted}  options={EXTENT_COMPETED} />
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {data.map((row) => (
          <div key={row.rank} className="flex items-center gap-3">
            <span className="w-6 text-xs font-mono text-gray-400 text-right shrink-0">
              {row.rank}
            </span>
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-800 truncate">{row.vendorName}</span>
              <div className="h-1.5 rounded-full bg-gray-100 w-full">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{ width: `${(row.dollarsObligated / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
              {fmt(row.dollarsObligated)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Sorted by dollars obligated · Agency 9700 (DoD)
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
