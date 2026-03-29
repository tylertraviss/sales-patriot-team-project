import { useEffect, useState } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const fmtCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fmtNumber   = new Intl.NumberFormat('en-US');

export default function KPIBanner() {
  const [kpi, setKpi]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/analytics/kpi`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setKpi(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalObligated = kpi ? fmtCurrency.format(kpi.totalObligated) : '$1.61B';
  const totalAwards    = kpi ? fmtNumber.format(kpi.totalAwards)      : '4,116';
  const totalVendors   = kpi ? fmtNumber.format(kpi.totalVendors)     : '2,379';
  const soleSourcePct  = kpi ? `${kpi.soleSourcePct}%`                : '8.4%';

  const KPIs = [
    { label: 'Total Obligated',  value: totalObligated },
    { label: 'Total Awards',     value: totalAwards    },
    { label: 'Vendors',          value: totalVendors   },
    { label: 'Sole Source Rate', value: soleSourcePct  },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <p className="text-white text-xl font-semibold leading-snug">
          {soleSourcePct} of contracts had <span className="text-yellow-400">zero competition.</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">
          That's where the locked-in money is — companies winning sole source contracts year after year.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-700 pt-4">
        {KPIs.map((k) => (
          <div key={k.label} className={loading ? 'opacity-50' : ''}>
            <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
