import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const YEARS       = ['all', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const AWARD_TYPES = ['all', 'DEFINITIVE CONTRACT', 'DELIVERY ORDER', 'PURCHASE ORDER', 'BPA CALL'];
const EXTENT_OPTS = ['all', 'D', 'A', 'B', 'CDO', 'G'];
const EXTENT_LABELS = { all: 'All competition', D: 'Full & Open (D)', A: 'Full & Open (A)', B: 'Not Available', CDO: 'Sole Source', G: 'Not Competed' };

// Convert sentinel 'all' back to '' for API calls
const toApi = (v) => v === 'all' ? '' : v;

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});

const CHART_CONFIG = {
  totalObligated: { label: 'Total Obligated', color: 'var(--chart-1)' },
};

export default function TopEarners() {
  const [year,          setYear]   = useState('all');
  const [awardType,     setAward]  = useState('all');
  const [extentCompeted,setExtent] = useState('all');
  const [data,          setData]   = useState([]);
  const [loading,       setLoading]= useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (toApi(year))           params.set('year',           toApi(year));
    if (toApi(awardType))      params.set('awardType',      toApi(awardType));
    if (toApi(extentCompeted)) params.set('extentCompeted', toApi(extentCompeted));
    fetch(`${BASE_URL}/dashboard/top-earners?${params}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setData(
        (json.data ?? []).map((r) => ({
          ...r,
          name: r.vendor_name,
          totalObligated: parseFloat(r.total_obligated) || 0,
        }))
      ))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [year, awardType, extentCompeted]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Top 10 Contract Earners</h2>
          <p className="text-xs text-slate-500 mt-0.5">Top vendors by total obligated dollars.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-[90px] text-xs">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y} className="text-xs">{y === 'all' ? 'All years' : y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={awardType} onValueChange={setAward}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {AWARD_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t === 'all' ? 'All types' : t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={extentCompeted} onValueChange={setExtent}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="All competition" />
            </SelectTrigger>
            <SelectContent>
              {EXTENT_OPTS.map((o) => (
                <SelectItem key={o} value={o} className="text-xs">{EXTENT_LABELS[o] ?? o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">No data</div>
        ) : (
          <ChartContainer config={CHART_CONFIG} className="h-[300px] w-full">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 72 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                interval={0}
                tickFormatter={(v) => v?.length > 18 ? v.slice(0, 18) + '…' : v}
              />
              <YAxis
                tickFormatter={(v) => fmtCompact.format(v)}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <ChartTooltip content={<ChartTooltipContent hideIndicator nameKey="name" />} />
              <Bar dataKey="totalObligated" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <p className="px-5 pb-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
        Sorted by dollars obligated · Top 10
      </p>
    </div>
  );
}
