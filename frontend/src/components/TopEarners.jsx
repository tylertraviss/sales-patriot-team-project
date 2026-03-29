// Temporary: seeded with real CSV data until backend /api/awards endpoint is wired up.
// Replace MOCK_DATA with: getAwards({ year: 2026, agencyCode: 9700, extentCompeted: 'D', sort: 'dollarsObligated', order: 'desc', limit: 10 })

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

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const max = MOCK_DATA[0].dollarsObligated;

export default function TopEarners() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Top 10 Contract Earners</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          This year's top earners, from the biggest agency, with no competition.
        </p>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-2">
        {MOCK_DATA.map((row) => (
          <div key={row.rank} className="flex items-center gap-3">
            {/* Rank */}
            <span className="w-6 text-xs font-mono text-gray-400 text-right shrink-0">
              {row.rank}
            </span>

            {/* Bar + name */}
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-800 truncate">{row.vendorName}</span>
              <div className="h-1.5 rounded-full bg-gray-100 w-full">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{ width: `${(row.dollarsObligated / max) * 100}%` }}
                />
              </div>
            </div>

            {/* Amount */}
            <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
              {fmt(row.dollarsObligated)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Filtered: Agency 9700 (DoD) · Sole source · Sorted by dollars obligated
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
