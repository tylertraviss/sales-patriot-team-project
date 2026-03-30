import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { getGeographicClustering } from '@/services/api';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});
const fmtNum = new Intl.NumberFormat('en-US');

// FIPS → state abbreviation mapping
const FIPS_TO_STATE = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
};

// Color scale: pale sky → deep navy blue, log-normalised
// No-data states stay light grey to clearly separate them from data states.
const NO_DATA_COLOR = '#e2e8f0'; // slate-200

function stateColor(obligated, max) {
  if (!obligated || !max) return NO_DATA_COLOR;
  const t = Math.log1p(obligated) / Math.log1p(max);
  const stops = [
    [224, 242, 254], // sky-100
    [125, 211, 252], // sky-300
    [14,  165, 233], // sky-500
    [2,   132, 199], // sky-600  — noticeably darker
    [3,   105, 161], // sky-700
    [12,  74,  110], // sky-900 (near-navy)
    [15,  23,  42],  // slate-950 (deep navy)
  ];
  const idx = t * (stops.length - 1);
  const lo = stops[Math.floor(idx)];
  const hi = stops[Math.min(Math.ceil(idx), stops.length - 1)];
  const f = idx - Math.floor(idx);
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * f);
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * f);
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * f);
  return `rgb(${r},${g},${b})`;
}

export default function VendorMap({ onStateClick }) {
  const [geoData, setGeoData]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [tooltip, setTooltip]   = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1000);
  const mapRef = useRef(null);

  // Attach a non-passive wheel listener so e.preventDefault() actually works
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      setScale((s) => Math.min(8000, Math.max(400, s * (e.deltaY < 0 ? 1.15 : 0.87))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  useEffect(() => {
    getGeographicClustering({ limit: 60 })
      .then((res) => setGeoData(res.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stateMap  = Object.fromEntries(geoData.map((d) => [d.stateCode, d]));
  const maxSpend  = Math.max(...geoData.map((d) => Number(d.totalObligated)), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[480px] rounded-xl bg-slate-50 border">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[480px] rounded-xl bg-slate-50 border">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border bg-slate-50 overflow-hidden"
      onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Geographic Spend Distribution</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Darker = higher total obligated · Scroll to zoom · Click state to filter vendors
          </p>
        </div>
        {/* Legend */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded-sm border border-slate-300" style={{ background: NO_DATA_COLOR }} />
          <span className="mr-1">No data</span>
          <span>Low</span>
          {[0.05, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
            <span
              key={t}
              className="inline-block w-5 h-3 rounded-sm"
              style={{ background: stateColor(t * maxSpend, maxSpend) }}
            />
          ))}
          <span>High</span>
        </div>
      </div>

      {/* Map + sidebar chart side by side */}
      <div className="flex">

        {/* Map — takes remaining width */}
        <div ref={mapRef} className="relative flex-1 min-w-0">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale }}
            className="w-full h-auto"
            viewBox="0 0 960 600"
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const fips  = geo.id;
                  const code  = FIPS_TO_STATE[String(fips).padStart(2, '0')];
                  const data  = code ? stateMap[code] : null;
                  const spend = data ? Number(data.totalObligated) : 0;
                  const fill  = stateColor(spend, maxSpend);
                  const isTop = !!data;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#ffffff"
                      strokeWidth={0.5}
                      style={{
                        default:  { outline: 'none', cursor: isTop ? 'pointer' : 'default' },
                        hover:    { outline: 'none', fill: isTop ? '#0284c7' : '#cbd5e1', cursor: isTop ? 'pointer' : 'default' },
                        pressed:  { outline: 'none' },
                      }}
                      onMouseEnter={() => code && setTooltip({ code, data, spend })}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => data && onStateClick?.(data)}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1">
            <button
              onClick={() => setScale((s) => Math.min(8000, s * 1.4))}
              className="w-7 h-7 rounded border bg-white shadow text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            >+</button>
            <button
              onClick={() => setScale((s) => Math.max(400, s / 1.4))}
              className="w-7 h-7 rounded border bg-white shadow text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
            >−</button>
            <button
              onClick={() => setScale(1000)}
              className="w-7 h-7 rounded border bg-white shadow text-[10px] font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
              title="Reset zoom"
            >↺</button>
          </div>
        </div>

        {/* Sidebar bar chart — fixed width */}
        {geoData.length > 0 && (() => {
          const chartData = geoData.slice(0, 10).map((d) => ({
            ...d,
            spend: Number(d.totalObligated),
            label: d.stateCode,
          }));
          const chartConfig = { spend: { label: 'Obligated', color: 'var(--chart-1)' } };
          return (
            <div className="w-56 shrink-0 border-l bg-white px-4 pt-4 pb-4 flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top States
              </p>
              <ChartContainer config={chartConfig} className="flex-1 w-full min-h-[200px]">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 52, left: 0, bottom: 0 }}
                  onClick={(e) => e?.activePayload?.[0] && onStateClick?.(e.activePayload[0].payload)}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={24}
                    tick={{ fontSize: 10, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideIndicator nameKey="label" />} />
                  <Bar
                    dataKey="spend"
                    fill="var(--chart-1)"
                    radius={[0, 3, 3, 0]}
                    maxBarSize={14}
                    cursor="pointer"
                    label={{
                      position: 'right',
                      formatter: (v) => fmtCompact.format(v),
                      fontSize: 10,
                    }}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          );
        })()}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 80 }}
        >
          <div className="rounded-lg border bg-white shadow-xl px-3 py-2 text-xs space-y-0.5 max-w-[220px]">
            <p className="font-semibold">
              {tooltip.data?.stateName ?? tooltip.code}
              <span className="ml-1.5 font-mono text-muted-foreground text-[10px]">{tooltip.code}</span>
            </p>
            {tooltip.data ? (
              <>
                <p className="text-sky-700 font-medium">{fmtCompact.format(tooltip.spend)}</p>
                <p className="text-muted-foreground">{fmtNum.format(tooltip.data.awardCount)} awards</p>
                <p className="text-muted-foreground">{Number(tooltip.data.pctOfNationalTotal).toFixed(1)}% of national total</p>
                {tooltip.data.topVendors?.[0] && (
                  <p className="text-muted-foreground pt-0.5 border-t mt-1 truncate">
                    Top: {tooltip.data.topVendors[0].name}
                  </p>
                )}
                <p className="text-[10px] text-sky-600 pt-0.5">Click to filter vendors</p>
              </>
            ) : (
              <p className="text-muted-foreground">No contract data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
