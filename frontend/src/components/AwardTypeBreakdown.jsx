// Temporary: seeded with real CSV data (2010).
// Replace MOCK_DATA with: getAwards grouped by awardTypeDescription

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MOCK_DATA = [
  { name: 'Definitive Contract', value: 1049566549 },
  { name: 'Delivery Order',      value: 543165789  },
  { name: 'Purchase Order',      value: 21173532   },
  { name: 'BPA Call',            value: 38942      },
];

const COLORS = ['#3b82f6', '#60a5fa', '#bfdbfe', '#dbeafe'];

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

const total = MOCK_DATA.reduce((s, d) => s + d.value, 0);

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
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
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Award Type Breakdown</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Definitive contracts = longer, more stable revenue streams.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={MOCK_DATA}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            labelLine={false}
            label={<CustomLabel />}
          >
            {MOCK_DATA.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip
            formatter={(v, name) => [fmt(v), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
        </PieChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        By dollars obligated · Total: {fmt(total)}
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
