import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getSectorHeatmap, getGeographicClustering } from '@/services/api';

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});
const fmtFull = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const fmtNum = new Intl.NumberFormat('en-US');

const SECTOR_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#f97316',
];

const YEAR_OPTIONS = ['All', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2015', '2010', '2005', '2000'];

// ── Custom tooltip for sector bar chart ─────────────────────────────────────
function SectorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur px-3 py-2 shadow-xl text-xs text-white space-y-1 max-w-[260px]">
      <p className="font-semibold text-white leading-snug">{d.naicsName}</p>
      <p className="text-blue-300 font-mono text-[10px]">NAICS {d.naicsCode}</p>
      <p className="text-white/80">{fmtFull.format(Number(d.totalObligated))} obligated</p>
      <p className="text-white/60">{fmtNum.format(d.awardCount)} awards</p>
    </div>
  );
}

// ── Expanded sector row showing top vendors ──────────────────────────────────
function SectorVendors({ vendors }) {
  if (!vendors?.length) return <p className="text-xs text-muted-foreground py-2 px-4">No vendor data available.</p>;
  return (
    <div className="px-4 py-3 bg-muted/20 border-t">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top Vendors</p>
      <div className="space-y-2">
        {vendors.map((v, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{v.name}</p>
              <div className="mt-0.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${Math.min(100, Number(v.marketSharePct))}%` }}
                />
              </div>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
              {Number(v.marketSharePct).toFixed(1)}%
            </span>
            <span className="text-xs tabular-nums text-foreground shrink-0 hidden sm:block">
              {fmtCompact.format(Number(v.totalObligated))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sector Heatmap section ───────────────────────────────────────────────────
function SectorHeatmap() {
  const [year, setYear] = useState('All');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    const params = { limit: 20 };
    if (year !== 'All') params.year = year;
    getSectorHeatmap(params)
      .then((res) => setData(res.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  const chartData = data.map((d) => ({
    ...d,
    totalObligated: Number(d.totalObligated),
    shortName: d.naicsName?.split(/,|;/)[0].trim().slice(0, 28),
  }));

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="text-base font-semibold">Sector Heatmap</h2>
            <p className="text-xs text-muted-foreground">Top 20 NAICS sectors by obligated spend</p>
          </div>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y === 'All' ? 'All Years' : `FY ${y}`}</option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div className="px-4 pt-4 pb-2">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-destructive text-center py-16">{error}</p>
        )}
        {!loading && !error && chartData.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">No data for selected year.</p>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis
                type="number"
                tickFormatter={(v) => fmtCompact.format(v)}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={200}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<SectorTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="totalObligated" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Expandable rows — top vendors per sector */}
      {!loading && !error && chartData.length > 0 && (
        <div className="border-t divide-y">
          {chartData.map((sector, i) => (
            <div key={sector.naicsCode}>
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                  />
                  <span className="text-xs font-medium truncate">{sector.naicsName}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {fmtNum.format(sector.awardCount)} awards
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold tabular-nums">
                    {fmtCompact.format(sector.totalObligated)}
                  </span>
                  {expanded === i
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </button>
              {expanded === i && <SectorVendors vendors={sector.topVendors} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Geographic Clustering section ────────────────────────────────────────────
function GeographicClustering() {
  const [year, setYear] = useState('All');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    const params = { limit: 10 };
    if (year !== 'All') params.year = year;
    getGeographicClustering(params)
      .then((res) => setData(res.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  const maxObligated = Math.max(...data.map((d) => Number(d.totalObligated)), 1);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-emerald-500" />
          <div>
            <h2 className="text-base font-semibold">Geographic Clustering</h2>
            <p className="text-xs text-muted-foreground">Top states by total obligated spend</p>
          </div>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y === 'All' ? 'All Years' : `FY ${y}`}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && error && (
        <p className="text-sm text-destructive text-center py-12">{error}</p>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">No data for selected year.</p>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="divide-y">
          {data.map((state, i) => {
            const pct = (Number(state.totalObligated) / maxObligated) * 100;
            const isOpen = expanded === i;
            return (
              <div key={state.stateCode}>
                <button
                  className="w-full px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>

                    {/* State badge */}
                    <span className="inline-flex items-center justify-center w-9 h-7 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0 border border-emerald-200">
                      {state.stateCode}
                    </span>

                    {/* Name + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{state.stateName}</span>
                        <span className="text-xs font-semibold tabular-nums text-emerald-700">
                          {fmtCompact.format(Number(state.totalObligated))}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-muted-foreground">{fmtNum.format(state.awardCount)} awards</p>
                      <p className="text-xs text-muted-foreground">{Number(state.pctOfNationalTotal).toFixed(1)}% national</p>
                    </div>

                    {isOpen
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                </button>

                {/* Top vendors per state */}
                {isOpen && (
                  <div className="px-4 py-3 bg-muted/20 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top Regional Vendors</p>
                    <div className="space-y-2">
                      {state.topVendors?.map((v, vi) => (
                        <div key={vi} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{vi + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{v.name}</p>
                            <div className="mt-0.5 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${Math.min(100, Number(v.regionalMarketSharePct))}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                            {Number(v.regionalMarketSharePct).toFixed(1)}%
                          </span>
                          <span className="text-xs tabular-nums text-foreground shrink-0 hidden sm:block">
                            {fmtCompact.format(Number(v.totalObligated))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Analytics page ───────────────────────────────────────────────────────────
export default function Analytics() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sector spend breakdown and geographic concentration of contract awards.
        </p>
      </div>

      <SectorHeatmap />
      <GeographicClustering />
    </div>
  );
}
