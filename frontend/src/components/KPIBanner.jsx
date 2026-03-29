import { useEffect, useState } from 'react';
import { getDashboardKPIs } from '../services/api';

function fmt(n) {
  if (!n) return '$0';
  const num = parseFloat(n);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${num.toLocaleString()}`;
}

export default function KPIBanner() {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    getDashboardKPIs().then(setKpis).catch(console.error);
  }, []);

  const kpiList = [
    { label: 'Total Obligated',  value: kpis ? fmt(kpis.total_obligated)  : '—' },
    { label: 'Total Awards',     value: kpis ? parseInt(kpis.total_awards).toLocaleString() : '—' },
    { label: 'Companies',        value: kpis ? parseInt(kpis.total_vendors).toLocaleString() : '—' },
    { label: 'Sole Source Rate', value: kpis ? `${kpis.sole_source_rate}%` : '—' },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <p className="text-white text-xl font-semibold leading-snug">
          {kpis?.sole_source_rate}% of contracts had{' '}
          <span className="text-yellow-400">zero competition.</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">
          That's where the locked-in money is — companies winning sole source contracts year after year.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-700 pt-4">
        {kpiList.map((k) => (
          <div key={k.label}>
            <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
