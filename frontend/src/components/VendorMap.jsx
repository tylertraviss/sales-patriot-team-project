import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { getGeographicClustering } from '@/services/api';

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});
const fmtNum = new Intl.NumberFormat('en-US');

// ── Approximate bounding-box centres for positioning state labels on a
//    equirectangular projection clipped to the continental US + AK/HI insets.
//    x/y are percentages of the 960×600 viewBox used below.
const STATE_POSITIONS = {
  AL: [730, 450], AK: [130, 520], AZ: [215, 420], AR: [650, 400],
  CA: [115, 350], CO: [330, 330], CT: [870, 230], DE: [855, 275],
  FL: [760, 510], GA: [745, 450], HI: [250, 560], ID: [215, 220],
  IL: [670, 295], IN: [700, 290], IA: [610, 255], KS: [545, 345],
  KY: [715, 340], LA: [645, 470], ME: [895, 165], MD: [842, 285],
  MA: [878, 212], MI: [700, 225], MN: [590, 195], MS: [680, 450],
  MO: [640, 340], MT: [295, 190], NE: [520, 295], NV: [170, 320],
  NH: [875, 195], NJ: [860, 260], NM: [305, 415], NY: [830, 220],
  NC: [780, 375], ND: [510, 175], OH: [745, 285], OK: [560, 390],
  OR: [145, 245], PA: [810, 255], RI: [882, 225], SC: [775, 415],
  SD: [515, 230], TN: [715, 385], TX: [530, 455], UT: [255, 335],
  VT: [858, 188], VA: [800, 330], WA: [165, 185], WV: [775, 315],
  WI: [650, 215], WY: [320, 265], DC: [845, 295],
};

// ── Simple equirectangular projection ────────────────────────────────────────
// Maps lat/lng to x/y within a 960×600 SVG viewBox
// Continental US roughly: lng -125…-66, lat 24…50
const W = 960, H = 600;
const LNG_MIN = -128, LNG_MAX = -65;
const LAT_MIN = 23,   LAT_MAX = 51;

function project(lat, lng) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  return [x, y];
}

// State centroids (lat/lng) for pin placement
const STATE_COORDS = {
  AL: [32.806, -86.791], AK: [61.370, -152.404], AZ: [33.729, -111.431],
  AR: [34.969, -92.373], CA: [36.778, -119.418], CO: [39.550, -105.782],
  CT: [41.597, -72.755], DE: [39.318, -75.507],  FL: [27.994, -81.760],
  GA: [32.165, -82.900], HI: [19.898, -155.665], ID: [44.240, -114.479],
  IL: [40.349, -88.986], IN: [39.849, -86.258],  IA: [42.011, -93.210],
  KS: [38.527, -96.726], KY: [37.669, -84.670],  LA: [31.169, -91.867],
  ME: [44.693, -69.382], MD: [39.045, -76.641],  MA: [42.230, -71.530],
  MI: [44.314, -85.602], MN: [46.392, -94.636],  MS: [32.741, -89.679],
  MO: [38.456, -92.288], MT: [46.921, -110.454], NE: [41.125, -98.268],
  NV: [38.313, -117.055],NH: [43.452, -71.563],  NJ: [40.298, -74.521],
  NM: [34.841, -106.249],NY: [42.165, -74.948],  NC: [35.630, -79.806],
  ND: [47.528, -99.784], OH: [40.388, -82.764],  OK: [35.565, -96.929],
  OR: [44.572, -122.071],PA: [40.590, -77.209],  RI: [41.681, -71.511],
  SC: [33.856, -80.945], SD: [44.299, -99.438],  TN: [35.747, -86.692],
  TX: [31.054, -97.563], UT: [40.150, -111.862], VT: [44.045, -72.710],
  VA: [37.769, -78.169], WA: [47.400, -121.490], WV: [38.491, -80.954],
  WI: [44.268, -89.616], WY: [42.755, -107.302], DC: [38.907, -77.036],
};

// ── Colour scale: white → emerald-900 ────────────────────────────────────────
function spendColor(value, max) {
  if (!value || !max) return '#f0fdf4';
  const t = Math.log1p(value) / Math.log1p(max);
  // Interpolate from #f0fdf4 (emerald-50) → #064e3b (emerald-900)
  const r = Math.round(240 + (6  - 240) * t);
  const g = Math.round(253 + (78 - 253) * t);
  const b = Math.round(244 + (59 - 244) * t);
  return `rgb(${r},${g},${b})`;
}

export default function VendorMap({ onStateClick }) {
  const [geoData, setGeoData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef();

  useEffect(() => {
    getGeographicClustering({ limit: 10 })
      .then((res) => setGeoData(res.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Build a lookup: stateCode → data
  const stateMap = Object.fromEntries(geoData.map((d) => [d.stateCode, d]));
  const maxObligated = Math.max(...geoData.map((d) => Number(d.totalObligated)), 1);

  function handleMouseMove(e) {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[480px] rounded-xl bg-gray-50 border">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[480px] rounded-xl bg-gray-50 border">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-xl border bg-white overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Title */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Geographic Spend Distribution</p>
        <p className="text-xs text-muted-foreground">Circle size = total obligated · Top 10 states highlighted</p>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ maxHeight: 520 }}
      >
        {/* Background */}
        <rect width={W} height={H} fill="#f8fafc" />

        {/* State circles (bubble map) */}
        {Object.entries(STATE_COORDS).map(([code, [lat, lng]]) => {
          // Skip AK/HI for main map — they get inset treatment
          if (code === 'AK' || code === 'HI') return null;
          const [x, y] = project(lat, lng);
          const data = stateMap[code];
          const obligated = data ? Number(data.totalObligated) : 0;
          const color = spendColor(obligated, maxObligated);
          const r = obligated > 0
            ? 12 + (Math.log1p(obligated) / Math.log1p(maxObligated)) * 28
            : 8;
          const isTop = !!data;

          return (
            <g key={code}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={color}
                stroke={isTop ? '#059669' : '#cbd5e1'}
                strokeWidth={isTop ? 1.5 : 0.8}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setTooltip({ code, data, obligated })}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => data && onStateClick?.(data)}
                style={{ filter: isTop ? 'drop-shadow(0 1px 3px rgba(5,150,105,0.3))' : 'none' }}
              />
              {r > 16 && (
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={obligated > 0 ? 9 : 8}
                  fontWeight={isTop ? '700' : '500'}
                  fill={isTop ? '#064e3b' : '#64748b'}
                  className="pointer-events-none select-none"
                >
                  {code}
                </text>
              )}
            </g>
          );
        })}

        {/* AK inset */}
        {(() => {
          const data = stateMap['AK'];
          const obligated = data ? Number(data.totalObligated) : 0;
          const r = obligated > 0
            ? 12 + (Math.log1p(obligated) / Math.log1p(maxObligated)) * 28
            : 14;
          const color = spendColor(obligated, maxObligated);
          return (
            <g>
              <rect x={20} y={460} width={120} height={100} rx={6} fill="#f1f5f9" stroke="#e2e8f0" />
              <text x={80} y={476} textAnchor="middle" fontSize={8} fill="#94a3b8">ALASKA</text>
              <circle
                cx={80} cy={515} r={r}
                fill={color} stroke={data ? '#059669' : '#cbd5e1'} strokeWidth={data ? 1.5 : 0.8}
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ code: 'AK', data, obligated })}
                onMouseLeave={() => setTooltip(null)}
              />
              <text x={80} y={516} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="600" fill={data ? '#064e3b' : '#64748b'} className="pointer-events-none select-none">AK</text>
            </g>
          );
        })()}

        {/* HI inset */}
        {(() => {
          const data = stateMap['HI'];
          const obligated = data ? Number(data.totalObligated) : 0;
          const r = obligated > 0
            ? 12 + (Math.log1p(obligated) / Math.log1p(maxObligated)) * 28
            : 14;
          const color = spendColor(obligated, maxObligated);
          return (
            <g>
              <rect x={155} y={460} width={120} height={100} rx={6} fill="#f1f5f9" stroke="#e2e8f0" />
              <text x={215} y={476} textAnchor="middle" fontSize={8} fill="#94a3b8">HAWAII</text>
              <circle
                cx={215} cy={515} r={r}
                fill={color} stroke={data ? '#059669' : '#cbd5e1'} strokeWidth={data ? 1.5 : 0.8}
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ code: 'HI', data, obligated })}
                onMouseLeave={() => setTooltip(null)}
              />
              <text x={215} y={516} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="600" fill={data ? '#064e3b' : '#64748b'} className="pointer-events-none select-none">HI</text>
            </g>
          );
        })()}

        {/* Legend */}
        <g transform="translate(760, 30)">
          <text fontSize={9} fill="#64748b" fontWeight="600">SPEND CONCENTRATION</text>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <g key={i} transform={`translate(${i * 30}, 12)`}>
              <circle
                cx={15} cy={8}
                r={6 + t * 14}
                fill={spendColor(t * maxObligated, maxObligated)}
                stroke="#059669" strokeWidth={0.8}
              />
            </g>
          ))}
          <text x={0}   y={40} fontSize={8} fill="#94a3b8">Low</text>
          <text x={110} y={40} fontSize={8} fill="#94a3b8" textAnchor="end">High</text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 70 }}
        >
          <div className="rounded-lg border bg-white shadow-xl px-3 py-2 text-xs space-y-0.5 max-w-[220px]">
            <p className="font-semibold">
              {tooltip.data?.stateName ?? tooltip.code}
              <span className="ml-1 font-mono text-muted-foreground text-[10px]">({tooltip.code})</span>
            </p>
            {tooltip.data ? (
              <>
                <p className="text-emerald-700 font-medium">{fmtCompact.format(tooltip.obligated)}</p>
                <p className="text-muted-foreground">{fmtNum.format(tooltip.data.awardCount)} awards</p>
                <p className="text-muted-foreground">{Number(tooltip.data.pctOfNationalTotal).toFixed(1)}% of national total</p>
                {tooltip.data.topVendors?.[0] && (
                  <p className="text-muted-foreground pt-0.5 border-t mt-1 truncate">
                    Top: {tooltip.data.topVendors[0].name}
                  </p>
                )}
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
