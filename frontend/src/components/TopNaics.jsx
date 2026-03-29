import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

const CustomTick = ({ x, y, payload }) => (
  <text x={x} y={y} dy={4} textAnchor="end" fill="#9ca3af" fontSize={11}>
    {payload.value.length > 28 ? payload.value.slice(0, 28) + '…' : payload.value}
  </text>
);

export default function TopNaics() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/naics?sort=total_obligated&order=desc&limit=8`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        setData((json.data ?? []).map((row) => ({
          code:  row.code,
          name:  row.name ?? row.code,
          total: parseFloat(row.totalObligated) || 0,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Top Industries by NAICS</h2>
        <p className="text-sm text-gray-400 mt-0.5">Which sectors have the most government tailwind.</p>
      </div>

      {loading ? (
        <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={<CustomTick />} axisLine={false} tickLine={false} width={180} />
            <Tooltip
              formatter={(v) => [fmt(v), 'Obligated']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Top 8 NAICS codes by dollars obligated
      </p>
    </div>
  );
}
