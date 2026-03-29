// Temporary: seeded with real CSV data until backend /api/awards endpoint is wired up.
// Replace MOCK_DATA with: getAwards({ year, agencyCode: 9700, extentCompeted, awardType, sort: 'dollarsObligated', order: 'desc', limit: 10 })

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MOCK_DATA = [
  { rank: 1,  vendorName: 'THE BOEING CO',         dollarsObligated: 22336252 },
  { rank: 2,  vendorName: 'MOOG INC.',              dollarsObligated: 9171750  },
  { rank: 3,  vendorName: 'EVERGREEN INTL AIRLINES',dollarsObligated: 7344887  },
  { rank: 4,  vendorName: 'HARRIS IT SERVICES',     dollarsObligated: 4430384  },
  { rank: 5,  vendorName: 'TOMPCO-TRITON',          dollarsObligated: 2704000  },
  { rank: 6,  vendorName: 'BIOENGINEERING ARCADIS', dollarsObligated: 2602908  },
  { rank: 7,  vendorName: 'INTL BIOMETRIC GROUP',   dollarsObligated: 2447064  },
  { rank: 8,  vendorName: 'FEDERAL PRISON IND.',    dollarsObligated: 2239000  },
  { rank: 9,  vendorName: 'FEDEX CHARTER TEAM',     dollarsObligated: 1688816  },
  { rank: 10, vendorName: 'SPACELINK INTL LLC',     dollarsObligated: 1688110  },
];

const YEARS        = ['N/A', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const AWARD_TYPES  = ['N/A', 'DEFINITIVE CONTRACT', 'DELIVERY ORDER', 'PURCHASE ORDER', 'BPA CALL'];
const EXTENT_OPTS  = ['N/A', 'D — Sole Source', 'A — Full & Open', 'B — Not Available'];

const COLORS = MOCK_DATA.map((_, i) =>
  i === 0 ? '#3b82f6' : `hsl(${217 - i * 8}, ${70 - i * 3}%, ${55 + i * 2}%)`
);

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400 cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-gray-800">{d.vendorName}</p>
      <p className="text-gray-500 mt-0.5">{fmt(d.dollarsObligated)} obligated</p>
    </div>
  );
};

export default function TopEarners() {
  const [year, setYear]         = useState('N/A');
  const [awardType, setType]    = useState('N/A');
  const [competed, setCompeted] = useState('N/A');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      {/* Header + filters */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top 10 Contract Earners</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            This year's top earners, from the biggest agency, with no competition.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <FilterSelect label="Year"       value={year}      onChange={setYear}      options={YEARS}       />
          <FilterSelect label="Award Type" value={awardType} onChange={setType}      options={AWARD_TYPES} />
          <FilterSelect label="Competed"   value={competed}  onChange={setCompeted}  options={EXTENT_OPTS} />
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={MOCK_DATA} margin={{ top: 0, right: 8, left: 0, bottom: 60 }}>
          <XAxis
            dataKey="vendorName"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
          <Bar dataKey="dollarsObligated" radius={[4, 4, 0, 0]}>
            {MOCK_DATA.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Sorted by dollars obligated · Agency 9700 (DoD)
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
