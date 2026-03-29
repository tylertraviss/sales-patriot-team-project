import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getSpendingByState } from '../services/api';

const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#e0f2fe', '#f0f9ff', '#f8fafc', '#f1f5f9', '#e2e8f0'];

function fmt(n) {
  const num = parseFloat(n);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${(num / 1e3).toFixed(0)}K`;
}

export default function SpendingByState() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSpendingByState()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Spending by State</h2>
        <p className="text-sm text-gray-400 mt-0.5">Where the money is going geographically.</p>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(v) => [fmt(v), 'Obligated']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Bar dataKey="total_obligated" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Top 10 states by dollars obligated · Live data
      </p>
    </div>
  );
}
