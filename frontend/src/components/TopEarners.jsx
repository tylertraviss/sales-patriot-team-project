import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getTopEarners } from '../services/api';

const YEARS       = ['All', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const AWARD_TYPES = ['All', 'DEFINITIVE CONTRACT', 'DELIVERY ORDER', 'PURCHASE ORDER', 'BPA CALL'];
const EXTENT_OPTS = ['All', 'D', 'A', 'B'];
const EXTENT_LABELS = { D: 'Sole Source', A: 'Full & Open', B: 'Not Available' };

function fmt(n) {
  const num = parseFloat(n);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${(num / 1e3).toFixed(0)}K`;
}

function FilterSelect({ label, value, onChange, options, displayMap }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400 cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{displayMap?.[o] ?? o}</option>)}
      </select>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-gray-800">{d.vendor_name}</p>
      <p className="text-gray-500 mt-0.5">{fmt(d.total_obligated)} obligated</p>
      <p className="text-gray-400">{d.award_count} awards</p>
    </div>
  );
};

export default function TopEarners() {
  const [year, setYear]         = useState('All');
  const [awardType, setType]    = useState('All');
  const [competed, setCompeted] = useState('All');
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (year !== 'All')      params.year = year;
    if (awardType !== 'All') params.awardType = awardType;
    if (competed !== 'All')  params.extentCompeted = competed;

    getTopEarners(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, awardType, competed]);

  const max = data[0]?.total_obligated ?? 1;
  const COLORS = data.map((_, i) => `hsl(${217 - i * 8}, ${70 - i * 3}%, ${55 + i * 2}%)`);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top 10 Contract Earners</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Top vendors by total dollars obligated.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <FilterSelect label="Year"       value={year}      onChange={setYear}      options={YEARS}       />
          <FilterSelect label="Award Type" value={awardType} onChange={setType}      options={AWARD_TYPES} />
          <FilterSelect label="Competed"   value={competed}  onChange={setCompeted}  options={EXTENT_OPTS} displayMap={{ All: 'All', ...EXTENT_LABELS }} />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 60 }}>
            <XAxis dataKey="vendor_name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="total_obligated" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Sorted by dollars obligated · Live data
      </p>
    </div>
  );
}
