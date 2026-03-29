// Temporary: seeded with real CSV data (2010).
// Replace MOCK_DATA with: getAwards grouped by naicsCode, sort by total

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MOCK_DATA = [
  { code: '336411', name: 'Aircraft Manufacturing',              total: 781655784 },
  { code: '336992', name: 'Military Armored Vehicles',           total: 135522257 },
  { code: '334511', name: 'Search & Navigation Equipment',       total: 76360494  },
  { code: '336212', name: 'Truck Trailer Manufacturing',         total: 64159797  },
  { code: '541330', name: 'Engineering Services',                total: 62441771  },
  { code: '334220', name: 'Radio & TV Broadcasting Equipment',   total: 59492744  },
  { code: '237990', name: 'Heavy & Civil Engineering',           total: 41578726  },
  { code: '336413', name: 'Aircraft Parts & Equipment',          total: 40597181  },
];

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
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Top Industries by NAICS</h2>
        <p className="text-sm text-gray-400 mt-0.5">Which sectors have the most government tailwind.</p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={MOCK_DATA} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
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

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Top 8 NAICS codes by dollars obligated
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
