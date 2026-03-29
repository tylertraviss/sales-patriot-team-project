import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const YEARS       = ['', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const AWARD_TYPES = ['', 'DEFINITIVE CONTRACT', 'DELIVERY ORDER', 'PURCHASE ORDER', 'BPA CALL'];
const EXTENT_OPTS = ['', 'D', 'A', 'B', 'CDO', 'G'];

const EXTENT_LABELS = { D: 'D — Full & Open', A: 'A — Full & Open', B: 'B — Not Available', CDO: 'CDO — Sole Source', G: 'G — Not Competed', '': 'All' };

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function FilterSelect({ label, value, onChange, options, labelMap }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400 cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{labelMap ? (labelMap[o] ?? (o || 'All')) : (o || 'All')}</option>)}
      </select>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-gray-800">{d.name}</p>
      <p className="text-gray-500 mt-0.5">{fmt(d.totalObligated)} obligated</p>
    </div>
  );
};

export default function TopEarners() {
  const [year, setYear]               = useState('');
  const [awardType, setAwardType]     = useState('');
  const [extentCompeted, setExtent]   = useState('');
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (year)           params.set('year', year);
    if (awardType)      params.set('awardType', awardType);
    if (extentCompeted) params.set('extentCompeted', extentCompeted);

    fetch(`${BASE_URL}/dashboard/top-earners?${params.toString()}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setData((json.data ?? []).map((r) => ({ ...r, name: r.vendor_name, totalObligated: parseFloat(r.total_obligated) || 0 }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [year, awardType, extentCompeted]);

  const COLORS = data.map((_, i) =>
    i === 0 ? '#3b82f6' : `hsl(${217 - i * 8}, ${70 - i * 3}%, ${55 + i * 2}%)`
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top 10 Contract Earners</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Top earners by total obligated dollars.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <FilterSelect label="Year"        value={year}          onChange={setYear}    options={YEARS}       />
          <FilterSelect label="Award Type"  value={awardType}     onChange={setAwardType} options={AWARD_TYPES} />
          <FilterSelect label="Competition" value={extentCompeted} onChange={setExtent}  options={EXTENT_OPTS} labelMap={EXTENT_LABELS} />
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={460}>
          <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 200 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              angle={-45}
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
            <Bar dataKey="totalObligated" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Sorted by dollars obligated
      </p>
    </div>
  );
}
