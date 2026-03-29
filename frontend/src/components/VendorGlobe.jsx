import { useEffect, useRef, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';

// ── All 50 US state centroids ─────────────────────────────────────────────────
const STATE_COORDS = {
  AL: { lat: 32.806,  lng: -86.791  },
  AK: { lat: 61.370,  lng: -152.404 },
  AZ: { lat: 33.729,  lng: -111.431 },
  AR: { lat: 34.969,  lng: -92.373  },
  CA: { lat: 36.778,  lng: -119.418 },
  CO: { lat: 39.550,  lng: -105.782 },
  CT: { lat: 41.597,  lng: -72.755  },
  DE: { lat: 39.318,  lng: -75.507  },
  FL: { lat: 27.994,  lng: -81.760  },
  GA: { lat: 32.165,  lng: -82.900  },
  HI: { lat: 19.898,  lng: -155.665 },
  ID: { lat: 44.240,  lng: -114.479 },
  IL: { lat: 40.349,  lng: -88.986  },
  IN: { lat: 39.849,  lng: -86.258  },
  IA: { lat: 42.011,  lng: -93.210  },
  KS: { lat: 38.527,  lng: -96.726  },
  KY: { lat: 37.669,  lng: -84.670  },
  LA: { lat: 31.169,  lng: -91.867  },
  ME: { lat: 44.693,  lng: -69.382  },
  MD: { lat: 39.045,  lng: -76.641  },
  MA: { lat: 42.230,  lng: -71.530  },
  MI: { lat: 44.314,  lng: -85.602  },
  MN: { lat: 46.392,  lng: -94.636  },
  MS: { lat: 32.741,  lng: -89.679  },
  MO: { lat: 38.456,  lng: -92.288  },
  MT: { lat: 46.921,  lng: -110.454 },
  NE: { lat: 41.125,  lng: -98.268  },
  NV: { lat: 38.313,  lng: -117.055 },
  NH: { lat: 43.452,  lng: -71.563  },
  NJ: { lat: 40.298,  lng: -74.521  },
  NM: { lat: 34.841,  lng: -106.249 },
  NY: { lat: 42.165,  lng: -74.948  },
  NC: { lat: 35.630,  lng: -79.806  },
  ND: { lat: 47.528,  lng: -99.784  },
  OH: { lat: 40.388,  lng: -82.764  },
  OK: { lat: 35.565,  lng: -96.929  },
  OR: { lat: 44.572,  lng: -122.071 },
  PA: { lat: 40.590,  lng: -77.209  },
  RI: { lat: 41.681,  lng: -71.511  },
  SC: { lat: 33.856,  lng: -80.945  },
  SD: { lat: 44.299,  lng: -99.438  },
  TN: { lat: 35.747,  lng: -86.692  },
  TX: { lat: 31.054,  lng: -97.563  },
  UT: { lat: 40.150,  lng: -111.862 },
  VT: { lat: 44.045,  lng: -72.710  },
  VA: { lat: 37.769,  lng: -78.169  },
  WA: { lat: 47.400,  lng: -121.490 },
  WV: { lat: 38.491,  lng: -80.954  },
  WI: { lat: 44.268,  lng: -89.616  },
  WY: { lat: 42.755,  lng: -107.302 },
  DC: { lat: 38.907,  lng: -77.036  },
  PR: { lat: 18.221,  lng: -66.590  },
  GU: { lat: 13.444,  lng: 144.794  },
};

function resolveCoords(vendor) {
  // Support both snake_case (backend) and camelCase (mock)
  const state = (vendor.state_code ?? vendor.stateCode ?? '').toUpperCase().trim();
  if (state && STATE_COORDS[state]) return STATE_COORDS[state];
  return null;
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  notation: 'compact', maximumFractionDigits: 1,
});

// Log scale pin altitude so Boeing doesn't dwarf small vendors
function pinAltitude(total, max) {
  if (!total || !max) return 0.05;
  return 0.04 + (Math.log1p(total) / Math.log1p(max)) * 0.22;
}

function pinRadius(total, max) {
  if (!total || !max) return 0.3;
  return 0.25 + (Math.log1p(total) / Math.log1p(max)) * 1.1;
}

export default function VendorGlobe({ vendors = [], onVendorClick }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Build point data — only vendors with resolvable coordinates
  const points = vendors
    .map((v) => {
      const coords = resolveCoords(v);
      if (!coords) return null;
      return { ...v, ...coords };
    })
    .filter(Boolean);

  const maxObligated = Math.max(...points.map((p) => Number(p.total_obligated ?? p.totalObligated ?? 0)), 1);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.offsetWidth, h: Math.max(480, el.offsetWidth * 0.55) });
    });
    ro.observe(el);
    setSize({ w: el.offsetWidth, h: Math.max(480, el.offsetWidth * 0.55) });
    return () => ro.disconnect();
  }, []);

  // Start auto-rotation; stop on user interaction
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableDamping = true;
    // Point at USA on mount
    globe.pointOfView({ lat: 39, lng: -98, altitude: 1.8 }, 800);
  }, [size]); // re-run when globe remounts after resize

  // Track mouse position continuously so the tooltip actually follows the cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e) => setTooltipPos({ x: e.clientX, y: e.clientY });
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  const handlePointHover = useCallback((point) => {
    setHovered(point ?? null);
  }, []);

  const handlePointClick = useCallback((point) => {
    if (point && onVendorClick) onVendorClick(point);
  }, [onVendorClick]);

  return (
    <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden bg-[#080d1a] select-none">
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}

        // Globe appearance
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="rgba(100, 160, 255, 0.25)"
        atmosphereAltitude={0.18}

        // Vendor pins
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d) => pinAltitude(Number(d.total_obligated ?? d.totalObligated ?? 0), maxObligated)}
        pointRadius={(d) => pinRadius(Number(d.total_obligated ?? d.totalObligated ?? 0), maxObligated)}
        pointColor={() => 'rgba(96, 165, 250, 0.92)'}  // blue-400
        pointResolution={12}
        pointsMerge={false}
        onPointHover={handlePointHover}
        onPointClick={handlePointClick}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/80 space-y-1 pointer-events-none">
        <p className="font-semibold text-white/90">Vendor Locations</p>
        <p>{points.length} vendor{points.length !== 1 ? 's' : ''} plotted</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 opacity-50" />
          <span>Small spend</span>
          <span className="inline-block w-3.5 h-3.5 rounded-full bg-blue-400 ml-2" />
          <span>Large spend</span>
        </div>
        <p className="text-white/50 text-[10px]">Pin height &amp; size = total obligated</p>
      </div>

      {/* Controls hint */}
      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-md px-2 py-1 text-[10px] text-white/50 pointer-events-none">
        Drag to rotate · Scroll to zoom · Click pin to open vendor
      </div>

      {/* Hover tooltip — follows mouse continuously */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 18, top: tooltipPos.y - 60 }}
        >
          <div className="rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur px-3 py-2 shadow-xl text-xs text-white space-y-0.5 max-w-[220px]">
            <p className="font-semibold text-white leading-snug">{hovered.name ?? hovered.vendorName}</p>
            <p className="text-blue-300">
              {hovered.city}
              {(hovered.state_code ?? hovered.stateCode) ? `, ${hovered.state_code ?? hovered.stateCode}` : ''}
            </p>
            <p className="text-white/70">
              <span className="font-medium text-white">
                {fmt.format(Number(hovered.total_obligated ?? hovered.totalObligated ?? 0))}
              </span>
              {' '}obligated
            </p>
            <p className="text-white/50">{hovered.award_count ?? hovered.awardCount} award{(hovered.award_count ?? hovered.awardCount) !== 1 ? 's' : ''}</p>
            <p className="text-white/30 text-[10px] pt-0.5">Click to open details</p>
          </div>
        </div>
      )}
    </div>
  );
}
