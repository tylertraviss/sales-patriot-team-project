// Temporary: seeded with real CSV data (2010).
// Replace MOCK_DATA with: getAwards grouped by year + extentCompeted

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// extent_competed codes: A=Full & Open, B=Not Available, C=Full & Open after exclusion, D=Sole Source
const MOCK_DATA = [
  {
    year: '2009',
    'Full & Open':  402512,
    'Not Available': 0,
    'Sole Source':  0,
    'Other':        0,
  },
  {
    year: '2010',
    'Full & Open':  258721969,
    'Not Available': 19520869,
    'Sole Source':  69944180,
    'Other':        194580260,
  },
];

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

export default function CompetedOverTime() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sole Source vs. Competed Over Time</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Rising sole source = incumbents winning, less disruption risk.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={MOCK_DATA} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            formatter={(v, name) => [fmt(v), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
            cursor={{ fill: '#f9fafb' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <Bar dataKey="Full & Open"   stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
          <Bar dataKey="Sole Source"   stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
          <Bar dataKey="Not Available" stackId="a" fill="#e5e7eb" radius={[0,0,0,0]} />
          <Bar dataKey="Other"         stackId="a" fill="#93c5fd" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Stacked by competition type · Dollars obligated
        <span className="ml-2 italic text-amber-500">— sample data, 2009–2010</span>
      </p>
    </div>
  );
}
