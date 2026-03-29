import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
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

// Color scale: light → dark emerald based on log-normalised spend
function stateColor(obligated, max) {
  if (!obligated || !max) return '#f0fdf4';
  const t = Math.log1p(obligated) / Math.log1p(max);
  const stops = [
    [240, 253, 244], // emerald-50
    [187, 247, 208], // emerald-100
    [110, 231, 183], // emerald-300
    [16,  185, 129], // emerald-500
    [4,   120, 87],  // emerald-700
    [6,   78,  59],  // emerald-900
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
  const [zoom, setZoom]         = useState(1);

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
      className="relative rounded-xl border bg-slate-50 overflow-hidden"
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
          <span>Low</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
            <span
              key={t}
              className="inline-block w-5 h-3 rounded-sm"
              style={{ background: stateColor(t * maxSpend, maxSpend) }}
            />
          ))}
          <span>High</span>
        </div>
      </div>

      {/* Map */}
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        style={{ width: '100%', height: 'auto' }}
        viewBox="0 0 960 600"
      >
        <ZoomableGroup
          zoom={zoom}
          minZoom={1}
          maxZoom={6}
          onMoveEnd={({ zoom: z }) => setZoom(z)}
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
                      hover:    { outline: 'none', fill: isTop ? '#059669' : '#e2e8f0', cursor: isTop ? 'pointer' : 'default' },
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
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(6, z + 0.5))}
          className="w-7 h-7 rounded border bg-white shadow text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
        >+</button>
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          className="w-7 h-7 rounded border bg-white shadow text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center"
        >−</button>
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
                <p className="text-emerald-700 font-medium">{fmtCompact.format(tooltip.spend)}</p>
                <p className="text-muted-foreground">{fmtNum.format(tooltip.data.awardCount)} awards</p>
                <p className="text-muted-foreground">{Number(tooltip.data.pctOfNationalTotal).toFixed(1)}% of national total</p>
                {tooltip.data.topVendors?.[0] && (
                  <p className="text-muted-foreground pt-0.5 border-t mt-1 truncate">
                    Top: {tooltip.data.topVendors[0].name}
                  </p>
                )}
                <p className="text-[10px] text-emerald-600 pt-0.5">Click to filter vendors</p>
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
