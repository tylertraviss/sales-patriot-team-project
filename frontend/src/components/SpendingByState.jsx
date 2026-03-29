// Temporary: seeded with real CSV data (2010).
// Replace MOCK_DATA with: getAwards({ sort: 'dollarsObligated', order: 'desc' }) grouped by state

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MOCK_DATA = [
  { state: 'PA', total: 722134699 },
  { state: 'MI', total: 137210064 },
  { state: 'VA', total: 124256548 },
  { state: 'MD', total: 70104439  },
  { state: 'WI', total: 67304612  },
  { state: 'CA', total: 59284126  },
  { state: 'NY', total: 57245021  },
  { state: 'KS', total: 47496597  },
  { state: 'FL', total: 45075364  },
  { state: 'AZ', total: 39578550  },
];

const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#e0f2fe', '#f0f9ff', '#f8fafc', '#f1f5f9', '#e2e8f0'];

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

export default function SpendingByState() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Spending by State</h2>
        <p className="text-sm text-gray-400 mt-0.5">Where the money is going geographically.</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={MOCK_DATA} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(v) => [fmt(v), 'Obligated']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
            cursor={{ fill: '#f9fafb' }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {MOCK_DATA.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Top 10 states by dollars obligated
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
