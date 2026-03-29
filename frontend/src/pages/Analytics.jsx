import { useEffect, useMemo, useState } from 'react';
import { Fragment } from 'react';
import {
  BarChart3,
  Building2,
  Filter,
  Loader2,
  MapPinned,
  Radar,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import {
  getAnalyticsFilters,
  getEmergingWinners,
  getGeographicClustering,
  getMarketConcentration,
  getNaicsTrends,
  getOpportunityHeatmap,
  getRepeatWinners,
  getRevenueStabilityById,
  getSoleSourceOpportunities,
  getVendorMoat,
  getVendorRiskProfileById,
} from '@/services/api';

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fmtFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const fmtNum = new Intl.NumberFormat('en-US');

const VENDOR_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
const AWARD_TYPE_COLORS = ['#1d4ed8', '#0f766e', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#475569'];

const EMPTY_FILTERS = {
  year: '',
  agencyCode: '',
  naicsCode: '',
  stateCode: '',
  competitionBucket: '',
  setAsideCode: '',
};

function buildParams(filters) {
  return {
    year: filters.year || undefined,
    agency_code: filters.agencyCode || undefined,
    naics_code: filters.naicsCode || undefined,
    state_code: filters.stateCode || undefined,
    competition_bucket: filters.competitionBucket || undefined,
    set_aside_code: filters.setAsideCode || undefined,
  };
}

function numeric(value) {
  return Number(value || 0);
}

function ChartCard({ title, description, icon: Icon, actions, loading, error, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-700">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-center text-sm text-red-600">{error}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex min-w-[160px] flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function OpportunityHeatmap({ data, onSelectVendor }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No opportunity cells match the active filters.</p>;
  }

  const agencies = Array.from(new Set(data.map((row) => row.agencyCode))).slice(0, 6);
  const naicsCodes = Array.from(new Set(data.map((row) => row.naicsCode))).slice(0, 6);
  const maxValue = Math.max(...data.map((row) => numeric(row.totalObligated)), 1);
  const matrix = new Map(data.map((row) => [`${row.agencyCode}::${row.naicsCode}`, row]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[180px_repeat(6,minmax(88px,1fr))] gap-2">
          <div />
          {naicsCodes.map((naicsCode) => {
            const row = data.find((item) => item.naicsCode === naicsCode);
            return (
              <div key={naicsCode} className="px-2 text-xs font-medium text-slate-600">
                <p className="font-semibold text-slate-900">{naicsCode}</p>
                <p className="truncate">{row?.naicsName || naicsCode}</p>
              </div>
            );
          })}

          {agencies.map((agencyCode) => {
            const agency = data.find((item) => item.agencyCode === agencyCode);
            return (
              <Fragment key={agencyCode}>
                <div key={`${agencyCode}-label`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold text-slate-900">{agency?.agencyName || agencyCode}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{agencyCode}</p>
                </div>
                {naicsCodes.map((naicsCode) => {
                  const cell = matrix.get(`${agencyCode}::${naicsCode}`);
                  if (!cell) {
                    return <div key={`${agencyCode}-${naicsCode}`} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50" />;
                  }

                  const intensity = Math.max(0.12, numeric(cell.totalObligated) / maxValue);
                  const title = [
                    `${cell.agencyName} × ${cell.naicsName}`,
                    `${fmtFull.format(numeric(cell.totalObligated))} obligated`,
                    `${fmtNum.format(cell.awardCount)} awards`,
                    `Competed ${numeric(cell.competedSharePct).toFixed(1)}%`,
                    `Sole source ${numeric(cell.soleSourceSharePct).toFixed(1)}%`,
                    `Unknown ${numeric(cell.unknownCompetitionSharePct).toFixed(1)}%`,
                    `Top vendor: ${cell.topVendor?.name || 'Unknown'}`,
                  ].join('\n');

                  return (
                    <button
                      key={`${agencyCode}-${naicsCode}`}
                      type="button"
                      title={title}
                      onClick={() => cell.topVendor?.vendorId && onSelectVendor(cell.topVendor)}
                      className="rounded-xl border border-slate-200 px-2 py-3 text-left transition hover:scale-[1.01] hover:border-blue-300"
                      style={{
                        background: `linear-gradient(180deg, rgba(37,99,235,${0.05 + intensity * 0.35}) 0%, rgba(15,118,110,${0.05 + intensity * 0.2}) 100%)`,
                      }}
                    >
                      <p className="text-xs font-semibold text-slate-900">{fmtCompact.format(numeric(cell.totalObligated))}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{fmtNum.format(cell.awardCount)} awards</p>
                      <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                        {cell.topVendor?.name || 'No vendor'}
                      </p>
                    </button>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmergingWinners({ data, onSelectVendor }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No breakout vendors match the active filters.</p>;
  }

  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((vendor, index) => (
        <button
          key={vendor.vendorId}
          type="button"
          onClick={() => onSelectVendor(vendor)}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{vendor.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {vendor.cageCode || vendor.uei || vendor.vendorId} · {vendor.activeYears} active years
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-emerald-700">
              {numeric(vendor.growthPct).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">YoY growth</p>
          </div>
          <div className="hidden shrink-0 text-right md:block">
            <p className="text-sm font-semibold text-slate-900">{fmtCompact.format(numeric(vendor.totalObligated))}</p>
            <p className="text-xs text-slate-500">{fmtNum.format(vendor.awardCount)} awards</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function MoatPoint({ cx, cy, payload, onSelect }) {
  const radius = Math.max(6, Math.min(22, (numeric(payload.awardCount) / 1200) + 6));
  const fill = payload.soleSourceSharePct > 40 ? '#0f766e' : payload.soleSourceSharePct > 20 ? '#2563eb' : '#7c3aed';

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill}
      fillOpacity={0.78}
      stroke="#ffffff"
      strokeWidth={2}
      onClick={() => onSelect(payload)}
      className="cursor-pointer"
    />
  );
}

function VendorMoatScatter({ data, onSelectVendor }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No moat data is available for the active filters.</p>;
  }

  const scatterData = data.slice(0, 40).map((vendor) => ({
    ...vendor,
    activeYears: numeric(vendor.activeYears),
    totalObligated: numeric(vendor.totalObligated),
    awardCount: numeric(vendor.awardCount),
    soleSourceSharePct: numeric(vendor.soleSourceSharePct),
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="activeYears"
            name="Active years"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="totalObligated"
            name="Total obligated"
            tickFormatter={(value) => fmtCompact.format(value)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis type="number" dataKey="awardCount" range={[80, 800]} />
          <Tooltip
            cursor={{ strokeDasharray: '4 4' }}
            formatter={(value, name) => {
              if (name === 'totalObligated') return [fmtFull.format(numeric(value)), 'Total obligated'];
              return [value, name];
            }}
            contentStyle={{ borderRadius: 16, borderColor: '#e2e8f0' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const vendor = payload[0].payload;

              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  <p className="text-sm font-semibold text-slate-900">{vendor.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{vendor.cageCode || vendor.uei || vendor.vendorId}</p>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <p>{vendor.activeYears} active years</p>
                    <p>{fmtFull.format(vendor.totalObligated)} obligated</p>
                    <p>{fmtNum.format(vendor.awardCount)} awards</p>
                    <p>{vendor.soleSourceSharePct.toFixed(1)}% sole source</p>
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={scatterData} shape={(props) => <MoatPoint {...props} onSelect={onSelectVendor} />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function BuyerConcentrationRisk({ selectedVendor, profile }) {
  if (!selectedVendor?.vendorId) {
    return <p className="py-16 text-center text-sm text-slate-500">Select a vendor to inspect buyer concentration risk.</p>;
  }

  if (!profile?.topAgencies?.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No agency concentration data is available for this vendor.</p>;
  }

  const agencies = profile.topAgencies.map((agency) => ({
    ...agency,
    totalObligated: numeric(agency.totalObligated),
    sharePct: numeric(agency.sharePct),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SectionStat label="Top agency share" value={`${numeric(profile.topAgencySharePct).toFixed(1)}%`} />
        <SectionStat label="HHI concentration" value={fmtNum.format(numeric(profile.concentrationScore))} />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={agencies} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tickFormatter={(value) => `${numeric(value).toFixed(0)}%`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="agencyName" type="category" width={160} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${numeric(value).toFixed(2)}%`, 'Share of spend']} />
            <Bar dataKey="sharePct" fill="#0f766e" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SoleSourceOpportunity({ data, groupBy, onGroupByChange }) {
  const groupOptions = [
    { value: 'agency', label: 'Agency' },
    { value: 'naics', label: 'NAICS' },
    { value: 'state', label: 'State' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {groupOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onGroupByChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              groupBy === option.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!data.length ? (
        <p className="py-16 text-center text-sm text-slate-500">No sole-source groups match the active filters.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(value) => fmtCompact.format(value)} tick={{ fontSize: 11 }} />
              <YAxis dataKey="groupName" type="category" width={170} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;

                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      <p className="text-sm font-semibold text-slate-900">{row.groupName}</p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p>{fmtFull.format(numeric(row.soleSourceObligated))} sole-source obligated</p>
                        <p>{fmtNum.format(row.soleSourceAwardCount)} sole-source awards</p>
                        <p>{numeric(row.unknownCompetitionSharePct).toFixed(1)}% unknown competition coverage</p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="soleSourceObligated" fill="#dc2626" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MarketConcentration({ data }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No concentration groups are available for the active filters.</p>;
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((row) => (
        <div key={`${row.groupCode}-${row.groupName}`} className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{row.groupName}</p>
              <p className="mt-1 text-xs text-slate-500">Dominant vendor: {row.dominantVendor || 'Unknown'}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-900">{fmtCompact.format(numeric(row.totalObligated))}</p>
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <span>Top 5 share</span>
                <span>{numeric(row.top5SharePct).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, numeric(row.top5SharePct))}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <span>Top 10 share</span>
                <span>{numeric(row.top10SharePct).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, numeric(row.top10SharePct))}%` }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GeographicSpendHeatmap({ data, onSelectVendor }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No geographic spend is available for the active filters.</p>;
  }

  const max = Math.max(...data.map((row) => numeric(row.totalObligated)), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((state, index) => (
        <div key={state.stateCode} className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {state.stateName} ({state.stateCode})
                </p>
                <p className="shrink-0 text-sm font-semibold text-slate-900">{fmtCompact.format(numeric(state.totalObligated))}</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(6, (numeric(state.totalObligated) / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {(state.topVendors || []).slice(0, 3).map((vendor) => (
              <button
                key={vendor.vendorId}
                type="button"
                onClick={() => onSelectVendor(vendor)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
              >
                <span className="min-w-0 truncate text-xs font-medium text-slate-700">{vendor.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {numeric(vendor.regionalMarketSharePct).toFixed(1)}% · {fmtCompact.format(numeric(vendor.totalObligated))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NaicsTrend({ data }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No NAICS trend data is available for the active filters.</p>;
  }

  const series = Array.from(new Set(data.map((row) => row.naicsCode))).slice(0, 5);
  const byYear = new Map();

  data.forEach((row) => {
    const year = row.fiscalYear;
    const current = byYear.get(year) || { fiscalYear: year };
    current[row.naicsCode] = numeric(row.totalObligated);
    current[`${row.naicsCode}Label`] = row.naicsName;
    byYear.set(year, current);
  });

  const chartData = Array.from(byYear.values()).sort((a, b) => a.fiscalYear - b.fiscalYear);

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="fiscalYear" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => fmtCompact.format(value)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [fmtFull.format(numeric(value)), 'Obligated']} />
          <Legend />
          {series.map((naicsCode, index) => (
            <Line
              key={naicsCode}
              type="monotone"
              dataKey={naicsCode}
              name={data.find((row) => row.naicsCode === naicsCode)?.naicsName || naicsCode}
              stroke={VENDOR_COLORS[index % VENDOR_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RepeatWinnerRetention({ data }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No repeat-winner cohort data is available for the active filters.</p>;
  }

  const chartData = data.map((row) => ({
    ...row,
    vendorCount: numeric(row.vendorCount),
    totalObligated: numeric(row.totalObligated),
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => fmtCompact.format(value)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="vendorCount" name="Vendor count" fill="#2563eb" radius={[8, 8, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="totalObligated" name="Total obligated" stroke="#0f766e" strokeWidth={3} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueStability({ selectedVendor, data }) {
  if (!selectedVendor?.vendorId) {
    return <p className="py-16 text-center text-sm text-slate-500">Select a vendor to inspect award-type revenue stability.</p>;
  }

  if (!data.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No revenue stability rows are available for this vendor.</p>;
  }

  const awardTypes = Array.from(new Set(data.map((row) => row.awardType))).slice(0, 7);
  const byYear = new Map();

  data.forEach((row) => {
    const year = row.fiscalYear;
    const current = byYear.get(year) || { fiscalYear: year };
    current[row.awardType] = numeric(row.totalObligated);
    byYear.set(year, current);
  });

  const chartData = Array.from(byYear.values()).sort((a, b) => a.fiscalYear - b.fiscalYear);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">Selected vendor</p>
        <p className="text-sm font-semibold text-slate-900">{selectedVendor.name}</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="fiscalYear" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(value) => fmtCompact.format(value)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => [fmtFull.format(numeric(value)), 'Obligated']} />
            <Legend />
            {awardTypes.map((awardType, index) => (
              <Bar
                key={awardType}
                dataKey={awardType}
                stackId="awards"
                fill={AWARD_TYPE_COLORS[index % AWARD_TYPE_COLORS.length]}
                name={awardType}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    years: [],
    agencies: [],
    naics: [],
    states: [],
    setAsideCodes: [],
    competitionBuckets: [],
  });
  const [filterError, setFilterError] = useState(null);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [opportunityHeatmap, setOpportunityHeatmap] = useState([]);
  const [emergingWinners, setEmergingWinners] = useState([]);
  const [vendorMoat, setVendorMoat] = useState([]);
  const [soleSourceOpportunities, setSoleSourceOpportunities] = useState([]);
  const [marketConcentration, setMarketConcentration] = useState([]);
  const [geographicClustering, setGeographicClustering] = useState([]);
  const [naicsTrends, setNaicsTrends] = useState([]);
  const [repeatWinners, setRepeatWinners] = useState([]);
  const [riskProfile, setRiskProfile] = useState(null);
  const [revenueStability, setRevenueStability] = useState([]);

  const [soleSourceGroupBy, setSoleSourceGroupBy] = useState('agency');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const apiParams = useMemo(() => buildParams(filters), [filters]);

  useEffect(() => {
    let ignore = false;
    setFiltersLoading(true);
    setFilterError(null);

    getAnalyticsFilters()
      .then((data) => {
        if (!ignore) {
          setFilterOptions(data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setFilterError(error.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setFiltersLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setOverviewLoading(true);

    const requests = {
      opportunityHeatmap: getOpportunityHeatmap({ ...apiParams, limit: 36 }),
      emergingWinners: getEmergingWinners({ ...apiParams, limit: 12 }),
      vendorMoat: getVendorMoat({ ...apiParams, limit: 40 }),
      soleSourceOpportunities: getSoleSourceOpportunities({ ...apiParams, group_by: soleSourceGroupBy, limit: 10 }),
      marketConcentration: getMarketConcentration({ ...apiParams, group_by: 'naics', limit: 10 }),
      geographicClustering: getGeographicClustering({ ...apiParams, limit: 6 }),
      naicsTrends: getNaicsTrends({ ...apiParams, top_n: 5 }),
      repeatWinners: getRepeatWinners(apiParams),
    };

    Promise.allSettled(Object.values(requests))
      .then((results) => {
        if (ignore) return;

        const nextErrors = {};
        const keys = Object.keys(requests);

        keys.forEach((key, index) => {
          const result = results[index];
          if (result.status === 'rejected') {
            nextErrors[key] = result.reason?.message || 'Failed to load data.';
          }
        });

        setErrors((prev) => ({
          ...prev,
          opportunityHeatmap: nextErrors.opportunityHeatmap || null,
          emergingWinners: nextErrors.emergingWinners || null,
          vendorMoat: nextErrors.vendorMoat || null,
          soleSourceOpportunities: nextErrors.soleSourceOpportunities || null,
          marketConcentration: nextErrors.marketConcentration || null,
          geographicClustering: nextErrors.geographicClustering || null,
          naicsTrends: nextErrors.naicsTrends || null,
          repeatWinners: nextErrors.repeatWinners || null,
        }));

        setOpportunityHeatmap(results[0].status === 'fulfilled' ? results[0].value.data ?? [] : []);
        setEmergingWinners(results[1].status === 'fulfilled' ? results[1].value.data ?? [] : []);
        setVendorMoat(results[2].status === 'fulfilled' ? results[2].value.data ?? [] : []);
        setSoleSourceOpportunities(results[3].status === 'fulfilled' ? results[3].value.data ?? [] : []);
        setMarketConcentration(results[4].status === 'fulfilled' ? results[4].value.data ?? [] : []);
        setGeographicClustering(results[5].status === 'fulfilled' ? results[5].value.data ?? [] : []);
        setNaicsTrends(results[6].status === 'fulfilled' ? results[6].value.data ?? [] : []);
        setRepeatWinners(results[7].status === 'fulfilled' ? results[7].value.data ?? [] : []);
      })
      .finally(() => {
        if (!ignore) {
          setOverviewLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [apiParams, soleSourceGroupBy]);

  const vendorOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    [...emergingWinners, ...vendorMoat].forEach((vendor) => {
      if (!vendor?.vendorId || seen.has(vendor.vendorId)) return;
      seen.add(vendor.vendorId);
      options.push(vendor);
    });

    return options;
  }, [emergingWinners, vendorMoat]);

  useEffect(() => {
    if (selectedVendor?.vendorId && vendorOptions.some((vendor) => vendor.vendorId === selectedVendor.vendorId)) {
      return;
    }

    const fallback = emergingWinners[0] || vendorMoat[0] || null;
    if (fallback) {
      setSelectedVendor(fallback);
    }
  }, [selectedVendor?.vendorId, emergingWinners, vendorMoat, vendorOptions]);

  useEffect(() => {
    let ignore = false;
    if (!selectedVendor?.vendorId) {
      setRiskProfile(null);
      setRevenueStability([]);
      return;
    }

    setVendorLoading(true);
    Promise.allSettled([
      getVendorRiskProfileById(selectedVendor.vendorId, apiParams),
      getRevenueStabilityById(selectedVendor.vendorId, apiParams),
    ])
      .then(([riskResult, stabilityResult]) => {
        if (ignore) return;

        setErrors((prev) => ({
          ...prev,
          riskProfile: riskResult.status === 'rejected' ? riskResult.reason?.message || 'Failed to load risk profile.' : null,
          revenueStability: stabilityResult.status === 'rejected' ? stabilityResult.reason?.message || 'Failed to load revenue stability.' : null,
        }));

        setRiskProfile(riskResult.status === 'fulfilled' ? riskResult.value : null);
        setRevenueStability(stabilityResult.status === 'fulfilled' ? stabilityResult.value.data ?? [] : []);
      })
      .finally(() => {
        if (!ignore) {
          setVendorLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedVendor?.vendorId, apiParams]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function handleSelectVendor(vendor, { openDrawer = true } = {}) {
    if (!vendor?.vendorId) {
      return;
    }

    setSelectedVendor(vendor);
    if (openDrawer) {
      setDrawerOpen(true);
    }
  }

  const selectedVendorOptions = [
    { value: '', label: 'Auto-select top opportunity vendor' },
    ...vendorOptions.map((vendor) => ({
      value: vendor.vendorId,
      label: `${vendor.name} (${vendor.cageCode || vendor.uei || vendor.vendorId.slice(0, 8)})`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">SalesPatriot Opportunities</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Opportunity intelligence for durable federal winners</h1>
        <p className="max-w-4xl text-sm leading-6 text-slate-600">
          This workspace ranks breakout vendors, highlights concentration risk, surfaces sole-source pockets, and shows where federal contract demand is durable enough to support better prospecting and investment decisions.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Shared opportunity filters</h2>
              <p className="text-xs text-slate-500">All 10 charts below read from this same filter state.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Reset filters
          </button>
        </div>

        {filtersLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filterError ? (
          <p className="text-sm text-red-600">{filterError}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Year"
              value={filters.year}
              onChange={(value) => updateFilter('year', value)}
              options={[{ value: '', label: 'All fiscal years' }, ...filterOptions.years.map((year) => ({ value: String(year), label: `FY ${year}` }))]}
            />
            <FilterSelect
              label="Agency"
              value={filters.agencyCode}
              onChange={(value) => updateFilter('agencyCode', value)}
              options={[{ value: '', label: 'All agencies' }, ...filterOptions.agencies.map((agency) => ({ value: agency.code, label: `${agency.name} (${agency.code})` }))]}
            />
            <FilterSelect
              label="NAICS"
              value={filters.naicsCode}
              onChange={(value) => updateFilter('naicsCode', value)}
              options={[{ value: '', label: 'All NAICS codes' }, ...filterOptions.naics.map((naics) => ({ value: naics.code, label: `${naics.name} (${naics.code})` }))]}
            />
            <FilterSelect
              label="State"
              value={filters.stateCode}
              onChange={(value) => updateFilter('stateCode', value)}
              options={[{ value: '', label: 'All states' }, ...filterOptions.states.map((state) => ({ value: state.code, label: `${state.name} (${state.code})` }))]}
            />
            <FilterSelect
              label="Competition"
              value={filters.competitionBucket}
              onChange={(value) => updateFilter('competitionBucket', value)}
              options={[{ value: '', label: 'All competition buckets' }, ...filterOptions.competitionBuckets.map((bucket) => ({ value: bucket.code, label: bucket.name }))]}
            />
            <FilterSelect
              label="Set-aside"
              value={filters.setAsideCode}
              onChange={(value) => updateFilter('setAsideCode', value)}
              options={[{ value: '', label: 'All set-asides' }, ...filterOptions.setAsideCodes.map((setAside) => ({ value: setAside.code, label: setAside.name }))]}
            />
            <FilterSelect
              label="Selected vendor"
              value={selectedVendor?.vendorId || ''}
              onChange={(value) => {
                if (!value) {
                  setSelectedVendor(emergingWinners[0] || vendorMoat[0] || null);
                  return;
                }

                const vendor = vendorOptions.find((option) => option.vendorId === value);
                if (vendor) {
                  handleSelectVendor(vendor, { openDrawer: false });
                }
              }}
              options={selectedVendorOptions}
            />
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">Current vendor focus</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedVendor?.name || 'Auto-selecting'}</p>
              <p className="mt-1 text-xs text-slate-600">
                {selectedVendor?.cageCode || selectedVendor?.uei || 'Set by Emerging Winners, then Moat Scatter fallback'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Opportunity Heatmap"
          description="Agency-by-NAICS spend grid with top-vendor drill-in and explicit competition coverage."
          icon={TrendingUp}
          loading={overviewLoading}
          error={errors.opportunityHeatmap}
        >
          <OpportunityHeatmap data={opportunityHeatmap} onSelectVendor={handleSelectVendor} />
        </ChartCard>

        <ChartCard
          title="Emerging Winners"
          description="Breakout vendors ranked by growth, first-award signals, and total obligated spend."
          icon={Building2}
          loading={overviewLoading}
          error={errors.emergingWinners}
        >
          <EmergingWinners data={emergingWinners} onSelectVendor={handleSelectVendor} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Vendor Moat Scatter"
          description="Durability versus scale, with bubble size for award volume and color for sole-source share."
          icon={Radar}
          loading={overviewLoading}
          error={errors.vendorMoat}
        >
          <VendorMoatScatter data={vendorMoat} onSelectVendor={handleSelectVendor} />
        </ChartCard>

        <ChartCard
          title="Buyer Concentration Risk"
          description="Agency concentration for the selected vendor, including top-buyer share and HHI-style risk."
          icon={ShieldAlert}
          loading={vendorLoading}
          error={errors.riskProfile}
        >
          <BuyerConcentrationRisk selectedVendor={selectedVendor} profile={riskProfile} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Sole-Source Opportunity"
          description="Where not-competed dollars are concentrated, with unknown competition coverage called out directly."
          icon={BarChart3}
          loading={overviewLoading}
          error={errors.soleSourceOpportunities}
        >
          <SoleSourceOpportunity
            data={soleSourceOpportunities}
            groupBy={soleSourceGroupBy}
            onGroupByChange={setSoleSourceGroupBy}
          />
        </ChartCard>

        <ChartCard
          title="Market Concentration"
          description="Top-5 and top-10 vendor dominance inside each market slice."
          icon={ShieldAlert}
          loading={overviewLoading}
          error={errors.marketConcentration}
        >
          <MarketConcentration data={marketConcentration} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Geographic Spend Heatmap"
          description="Where federal contract dollars cluster geographically, with direct drill-in to dominant vendors."
          icon={MapPinned}
          loading={overviewLoading}
          error={errors.geographicClustering}
        >
          <GeographicSpendHeatmap data={geographicClustering} onSelectVendor={handleSelectVendor} />
        </ChartCard>

        <ChartCard
          title="NAICS Trend"
          description="Top sector trends over fiscal years under the current shared filter set."
          icon={TrendingUp}
          loading={overviewLoading}
          error={errors.naicsTrends}
        >
          <NaicsTrend data={naicsTrends} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Repeat Winner Retention"
          description="How much of the market sits with single-year players versus repeat multi-year winners."
          icon={Building2}
          loading={overviewLoading}
          error={errors.repeatWinners}
        >
          <RepeatWinnerRetention data={repeatWinners} />
        </ChartCard>

        <ChartCard
          title="Revenue Stability by Award Type"
          description="Selected-vendor revenue mix over time, split by award type buckets."
          icon={BarChart3}
          loading={vendorLoading}
          error={errors.revenueStability}
        >
          <RevenueStability selectedVendor={selectedVendor} data={revenueStability} />
        </ChartCard>
      </div>

      <VendorDetailDrawer
        cageCode={selectedVendor?.cageCode ?? selectedVendor?.uei}
        vendorId={selectedVendor?.vendorId}
        vendorName={selectedVendor?.name}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
