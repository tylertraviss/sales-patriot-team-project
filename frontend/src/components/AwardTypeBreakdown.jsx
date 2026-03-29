import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const COLORS = ['#3b82f6', '#60a5fa', '#bfdbfe', '#dbeafe'];

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, total }) => {
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const pct = ((value / total) * 100).toFixed(0);
  if (pct < 2) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {pct}%
    </text>
  );
};

export default function AwardTypeBreakdown() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use /api/awards with page=1 limit=1 grouped by type — we need aggregation.
    // The analytics sector-heatmap doesn't group by award type, so we hit /api/awards
    // with each award_type and collect totals via the analytics/kpi-adjacent approach.
    // Best available: fetch top awards and group client-side from the paginated endpoint.
    // For a proper aggregation we use the naics endpoint as a proxy — but the cleanest
    // approach given the current API is to hit /api/awards with each award_type.
    // Instead we use a small set of known types and fetch counts in parallel.
    const TYPES = [
      'DEFINITIVE CONTRACT',
      'DELIVERY ORDER',
      'PURCHASE ORDER',
      'BPA CALL',
    ];

    Promise.all(
      TYPES.map((t) =>
        fetch(`${BASE_URL}/awards?award_type=${encodeURIComponent(t)}&limit=1`)
          .then((r) => r.ok ? r.json() : { data: [], pagination: { total: 0 } })
          .catch(() => ({ data: [], pagination: { total: 0 } }))
      )
    ).then((results) => {
      // We need total obligated per type — fetch a larger sample and sum
      // Since /api/awards doesn't provide aggregated totals, fetch top 100 per type
      return Promise.all(
        TYPES.map((t, i) => {
          const total = results[i]?.pagination?.total ?? 0;
          if (total === 0) return Promise.resolve({ name: t, value: 0 });
          return fetch(`${BASE_URL}/awards?award_type=${encodeURIComponent(t)}&limit=100&sort=award_amount&order=desc`)
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((json) => ({
              name: t.charAt(0) + t.slice(1).toLowerCase(),
              value: (json.data ?? []).reduce((s, row) => s + (parseFloat(row.dollarsObligated) || 0), 0),
            }))
            .catch(() => ({ name: t, value: 0 }));
        })
      );
    }).then((rows) => {
      setData(rows.filter((r) => r.value > 0));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Award Type Breakdown</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Definitive contracts = longer, more stable revenue streams.
        </p>
      </div>

      {loading ? (
        <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              labelLine={false}
              label={(props) => <CustomLabel {...props} total={total} />}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              formatter={(v, name) => [fmt(v), name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
          </PieChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        By dollars obligated · Total: {fmt(total)}
      </p>
    </div>
  );
}
