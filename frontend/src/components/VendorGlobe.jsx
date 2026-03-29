import { useEffect, useRef, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';

// ── Coordinates for mock cities (city+state → lat/lng) ──────────────────────
const COORDS = {
  'RIDLEY PARK_PA':       { lat: 39.881,  lng: -75.330 },
  'STERLING HEIGHTS_MI':  { lat: 42.580,  lng: -83.030 },
  'OSHKOSH_WI':           { lat: 44.025,  lng: -88.543 },
  'CLARKSBURG_MD':        { lat: 39.108,  lng: -77.269 },
  'WICHITA_KS':           { lat: 37.692,  lng: -97.330 },
  'CUDDY_PA':             { lat: 40.352,  lng: -80.177 },
  'LA CROSSE_WI':         { lat: 43.801,  lng: -91.240 },
  'LYONS FALLS_NY':       { lat: 43.611,  lng: -75.371 },
  'RANCHO CORDOVA_CA':    { lat: 38.589,  lng: -121.303 },
  'TUCSON_AZ':            { lat: 32.222,  lng: -110.975 },
  'MARIETTA_GA':          { lat: 33.952,  lng: -84.550 },
  'SCOTTSDALE_AZ':        { lat: 33.494,  lng: -111.926 },
  // Fallbacks by state centre (for any real-API vendors without city match)
  'PA':  { lat: 40.590, lng: -77.209 },
  'MI':  { lat: 44.314, lng: -85.602 },
  'WI':  { lat: 44.500, lng: -89.500 },
  'MD':  { lat: 39.045, lng: -76.641 },
  'KS':  { lat: 38.527, lng: -96.726 },
  'NY':  { lat: 42.165, lng: -74.948 },
  'CA':  { lat: 36.778, lng: -119.418 },
  'AZ':  { lat: 34.048, lng: -111.093 },
  'GA':  { lat: 32.165, lng: -82.900 },
  'TX':  { lat: 31.000, lng: -100.000 },
  'VA':  { lat: 37.431, lng: -78.656 },
  'FL':  { lat: 27.994, lng: -81.760 },
};

function resolveCoords(vendor) {
  // Support both snake_case (backend) and camelCase (mock)
  const state   = vendor.state_code  ?? vendor.stateCode;
  const city    = vendor.city;
  const cityKey = `${city?.toUpperCase()}_${state?.toUpperCase()}`;
  if (COORDS[cityKey]) return COORDS[cityKey];
  if (state && COORDS[state.toUpperCase()]) return COORDS[state.toUpperCase()];
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
