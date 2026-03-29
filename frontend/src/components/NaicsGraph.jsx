import { useEffect, useRef, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Visual constants ──────────────────────────────────────────────────────────
const COLORS = {
  naics:    '#f59e0b',              // amber  — sector hub
  sole:     '#34d399',              // emerald — sole-source (low competition = strong position)
  competed: '#f87171',              // rose   — competed (high competition)
  mixed:    '#93c5fd',              // sky    — mixed
  naicsBg:  'rgba(245,158,11,0.12)',
  link:     'rgba(148,163,184,0.18)',
  bg:       '#080d1a',
};

// NAICS sector hub: fixed size. Vendor: small uniform circle, color only.
const NAICS_R  = 18;
const VENDOR_R = 5;   // small and uniform — color does the work, not size

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  notation: 'compact', maximumFractionDigits: 1,
});

function nodeColor(node) {
  if (node.type === 'naics') return COLORS.naics;
  return COLORS[node.competition] ?? COLORS.mixed;
}

// ── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2.5 text-xs text-white/80 space-y-1.5 pointer-events-none">
      <p className="font-semibold text-white/90 text-[11px] uppercase tracking-wider">Legend</p>
      {[
        { color: COLORS.naics,    label: 'NAICS Sector (hub)' },
        { color: COLORS.sole,     label: 'Sole-source — low competition' },
        { color: COLORS.mixed,    label: 'Mixed competition' },
        { color: COLORS.competed, label: 'Competed — high competition' },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
      <p className="text-white/40 text-[10px] border-t border-white/10 pt-1.5 mt-1">
        Drag · Scroll to zoom · Click vendor to inspect
      </p>
    </div>
  );
}

// ── Hover tooltip ─────────────────────────────────────────────────────────────
function Tooltip({ node, pos }) {
  if (!node) return null;
  return (
    <div className="fixed z-50 pointer-events-none" style={{ left: pos.x + 16, top: pos.y - 56 }}>
      <div className="rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs text-white space-y-1 max-w-[260px]">
        {node.type === 'naics' ? (
          <>
            <p className="font-semibold text-amber-300 leading-snug">{node.label}</p>
            <p className="font-mono text-white/50 text-[10px]">NAICS {node.naicsCode}</p>
            <p className="text-white/70">{node.vendorCount} vendors compete here</p>
            <p className="text-amber-200 font-medium">{fmt.format(node.totalObligated)} total obligated</p>
          </>
        ) : (
          <>
            <p className="font-semibold leading-snug">{node.label}</p>
            {node.stateCode && <p className="text-sky-300">{node.stateCode}</p>}
            <p className="font-medium">{fmt.format(node.totalObligated)}</p>
            <p className="text-white/60">{node.awardCount} award{node.awardCount !== 1 ? 's' : ''}</p>
            {node.avgOffersReceived != null && (
              <p className="text-white/60">Avg {node.avgOffersReceived} offers / contract</p>
            )}
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: nodeColor(node) }} />
              <span className="text-white/70">
                {node.competition === 'sole'     ? 'Mostly sole-source'   :
                 node.competition === 'competed' ? 'Mostly competed'      : 'Mixed competition'}
              </span>
            </div>
            <p className="text-white/30 text-[10px] pt-0.5">Click to open details</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NaicsGraph({ graphData, selectedSector, onVendorClick }) {
  const fgRef        = useRef();
  const containerRef = useRef();
  const [size,     setSize]     = useState({ w: 900, h: 680 });
  const [hovered,  setHovered]  = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Responsive resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.offsetWidth, h: Math.max(600, el.offsetWidth * 0.65) })
    );
    ro.observe(el);
    setSize({ w: el.offsetWidth, h: Math.max(600, el.offsetWidth * 0.65) });
    return () => ro.disconnect();
  }, []);

  // Mouse tracking for tooltip
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fn = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    el.addEventListener('mousemove', fn);
    return () => el.removeEventListener('mousemove', fn);
  }, []);

  // Zoom-to-fit whenever data changes
  useEffect(() => {
    if (!fgRef.current || !graphData?.nodes?.length) return;
    setTimeout(() => fgRef.current?.zoomToFit(500, 80), 600);
  }, [graphData, selectedSector]);

  // Apply repulsive forces on mount / data change to spread clusters out
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // Strong charge pushes all nodes apart; link distance keeps vendor near sector hub
    fg.d3Force('charge')?.strength(-320);
    fg.d3Force('link')?.distance((link) => {
      const src = link.source;
      if (src?.type === 'naics') return 90;
      return 60;
    });
    fg.d3Force('collision') && fg.d3Force('collision').radius((n) =>
      n.type === 'naics' ? NAICS_R + 20 : VENDOR_R + 8
    );
    fg.d3ReheatSimulation();
  }, [graphData]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const r         = node.type === 'naics' ? NAICS_R : VENDOR_R;
    const isHovered = hovered?.id === node.id;
    const color     = nodeColor(node);

    // Ambient glow behind NAICS hubs + hovered nodes
    if (node.type === 'naics' || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + (node.type === 'naics' ? 10 : 6), 0, 2 * Math.PI);
      ctx.fillStyle = node.type === 'naics' ? COLORS.naicsBg : 'rgba(255,255,255,0.07)';
      ctx.fill();
    }

    // Main circle — slightly transparent for vendors so overlaps are visible
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.type === 'vendor'
      ? color.replace(')', ',0.82)').replace('rgb', 'rgba')
      : color;
    ctx.fill();

    // Bright ring on hover
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2.5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5 / globalScale;
      ctx.stroke();
    }

    // ── Labels ──────────────────────────────────────────────────────────────
    // NAICS hubs: always show a short label below the node
    // Vendors: only on hover or when very zoomed in (> 3×)
    const showLabel = node.type === 'naics' || isHovered || globalScale > 3;
    if (!showLabel) return;

    const isSector  = node.type === 'naics';
    const rawLabel  = isSector
      ? (node.label.length > 22 ? node.label.slice(0, 22) + '…' : node.label)
      : (node.label.length > 24 ? node.label.slice(0, 24) + '…' : node.label);

    // Scale font down when zoomed out so labels don't blow up
    const baseFontSize = isSector ? 11 : 9;
    const fontSize     = Math.max(isSector ? 8 : 7, baseFontSize / globalScale);
    ctx.font           = `${isSector ? '600 ' : ''}${fontSize}px Inter,sans-serif`;
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'top';

    const textX = node.x;
    const textY = node.y + r + 3 / globalScale;
    const tw    = ctx.measureText(rawLabel).width;

    // Semi-transparent pill behind text
    const pad = 3 / globalScale;
    ctx.fillStyle = 'rgba(8,13,26,0.82)';
    ctx.beginPath();
    ctx.roundRect(
      textX - tw / 2 - pad, textY - pad / 2,
      tw + pad * 2, fontSize + pad,
      2 / globalScale
    );
    ctx.fill();

    ctx.fillStyle = isSector ? COLORS.naics : '#e2e8f0';
    ctx.fillText(rawLabel, textX, textY);
  }, [hovered]);

  const handleNodeHover = useCallback((node) => {
    setHovered(node ?? null);
    if (containerRef.current)
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
  }, []);

  const handleNodeClick = useCallback((node) => {
    if (node?.type === 'vendor' && onVendorClick)
      onVendorClick({ cageCode: node.cageCode, uei: node.uei, vendorName: node.label });
  }, [onVendorClick]);

  if (!graphData?.nodes?.length) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      No graph data available.
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden bg-[#080d1a]">
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor={COLORS.bg}
        // Nodes
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodeVal={(n) => (n.type === 'naics' ? NAICS_R ** 2 : VENDOR_R ** 2)}
        // Links — thin, subtle
        linkColor={() => COLORS.link}
        linkWidth={0.8}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.2}
        linkDirectionalParticleColor={() => 'rgba(148,163,184,0.4)'}
        // Physics — slow decay = more time to spread out
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        cooldownTicks={200}
        // Interaction
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        enableNodeDrag
        enableZoomInteraction
        minZoom={0.2}
        maxZoom={10}
      />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        {[
          { icon: <ZoomIn className="h-4 w-4" />,   fn: () => fgRef.current?.zoom(fgRef.current.zoom() * 1.5, 300) },
          { icon: <ZoomOut className="h-4 w-4" />,  fn: () => fgRef.current?.zoom(fgRef.current.zoom() / 1.5, 300) },
          { icon: <Maximize2 className="h-4 w-4" />,fn: () => fgRef.current?.zoomToFit(400, 80) },
        ].map(({ icon, fn }, i) => (
          <Button key={i} size="icon" variant="ghost"
            className="h-8 w-8 bg-black/50 text-white/60 hover:bg-black/70 hover:text-white"
            onClick={fn}
          >
            {icon}
          </Button>
        ))}
      </div>

      <Legend />
      <Tooltip node={hovered} pos={mousePos} />
    </div>
  );
}
