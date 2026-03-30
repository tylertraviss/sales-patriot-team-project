import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});

export default function TopNaics() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/dashboard/by-naics`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setData(
        (json.data ?? []).filter((row) => row.code).map((row) => ({
          code:      row.code,
          name:      row.name ?? row.code,
          total:     parseFloat(row.total_obligated) || 0,
          shortName: (row.name ?? row.code).length > 30
            ? (row.name ?? row.code).slice(0, 30) + '…'
            : (row.name ?? row.code),
        }))
      ))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Top Industries by NAICS</h2>
        <p className="text-xs text-slate-500 mt-0.5">Sectors with the most government contract tailwind.</p>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="h-[260px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => fmtCompact.format(v)}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                axisLine={false}
                tickLine={false}
                width={190}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => [fmtCompact.format(v), 'Obligated']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="px-5 pb-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
        Top 8 NAICS codes by dollars obligated
      </p>
    </div>
  );
}
