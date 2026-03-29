// Temporary: seeded with real CSV data (2010).
// Replace MOCK_NODES/MOCK_EDGES with live API data grouped by naicsCode + uei.
// Edges connect companies that share the same NAICS code (same industry = same competition space).
// Node size = total dollars obligated. Node color = avg offers received (red=sole source, green=competitive).

import { useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const MOCK_NODES = [
  { id: 'boeing1',    name: 'THE BOEING COMPANY',                    total: 704634536, avgOffers: 1.0, naics: '336413' },
  { id: 'gm_gdls',   name: 'GM GDLS DEFENSE GROUP',                  total: 135176329, avgOffers: 9.0, naics: '336992' },
  { id: 'oshkosh',   name: 'OSHKOSH CORPORATION',                    total: 64719140,  avgOffers: 1.0, naics: '336212' },
  { id: 'thales',    name: 'THALES COMMUNICATIONS',                  total: 45750264,  avgOffers: 1.0, naics: '334220' },
  { id: 'boeing2',   name: 'THE BOEING COMPANY (Aircraft)',           total: 44000000,  avgOffers: 4.0, naics: '336411' },
  { id: 'nicholson', name: 'NICHOLSON CONSTRUCTION',                 total: 30684515,  avgOffers: 2.0, naics: '237990' },
  { id: 'lhi',       name: 'LOGISTICS HEALTH INC',                   total: 23500000,  avgOffers: 3.0, naics: '621111' },
  { id: 'otis',      name: 'OTIS PRODUCTS, INC',                     total: 22336252,  avgOffers: 1.0, naics: '332994' },
  { id: 'healthnet', name: 'HEALTH NET FEDERAL SERVICES',            total: 19192190,  avgOffers: 3.0, naics: '524114' },
  { id: 'raytheon',  name: 'RAYTHEON COMPANY',                       total: 17703025,  avgOffers: 1.0, naics: '561210' },
  { id: 'lm1',       name: 'LOCKHEED MARTIN (Aircraft)',              total: 16389420,  avgOffers: 1.0, naics: '336411' },
  { id: 'gd_c4',     name: 'GENERAL DYNAMICS C4 SYSTEMS',            total: 15623211,  avgOffers: 1.5, naics: '541519' },
  { id: 'whiting',   name: 'WHITING TURNER CONTRACTING',             total: 13161446,  avgOffers: 3.0, naics: '236220' },
  { id: 'lm2',       name: 'LOCKHEED MARTIN (Navigation)',            total: 12602122,  avgOffers: 1.0, naics: '334511' },
  { id: 'bell',      name: 'BELL HELICOPTER TEXTRON',                total: 11387690,  avgOffers: 1.0, naics: '336413' },
];

// Edges: companies in the same NAICS code compete in the same space
const MOCK_EDGES = [
  { source: 'boeing1', target: 'bell',    label: 'Aircraft Parts (336413)' },
  { source: 'boeing2', target: 'lm1',     label: 'Aircraft Mfg (336411)'   },
];

const MAX_TOTAL = MOCK_NODES[0].total;

function nodeColor(avgOffers) {
  if (avgOffers <= 1)  return '#f87171'; // red   — sole source, locked in
  if (avgOffers <= 2)  return '#fb923c'; // orange
  if (avgOffers <= 4)  return '#facc15'; // yellow
  return '#4ade80';                       // green  — highly competitive
}

function nodeRadius(total) {
  return 6 + (total / MAX_TOTAL) * 28;
}

function fmtM(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

const GRAPH_DATA = {
  nodes: MOCK_NODES.map((n) => ({ ...n })),
  links: MOCK_EDGES,
};

export default function CompanyGraph() {
  const graphRef = useRef();

  const paintNode = useCallback((node, ctx) => {
    const r = nodeRadius(node.total);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor(node.avgOffers);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label for larger nodes only
    if (r > 12) {
      ctx.font = `${Math.max(8, r * 0.4)}px sans-serif`;
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const short = node.name.split(' ')[0];
      ctx.fillText(short, node.x, node.y);
    }
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Company Relationship Graph</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Nodes = companies · Size = dollars obligated · Color = avg offers received
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Sole source (1 offer)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Low competition</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Highly competitive</span>
        </div>
      </div>

      {/* Graph */}
      <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
        <ForceGraph2D
          ref={graphRef}
          graphData={GRAPH_DATA}
          width={1100}
          height={620}
          backgroundColor="#f9fafb"
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          nodeLabel={(n) => `${n.name}\n${fmtM(n.total)} obligated\nAvg offers: ${n.avgOffers}`}
          linkColor={() => '#e2e8f0'}
          linkWidth={1.5}
          linkLabel={(l) => l.label}
          enableNodeDrag
          enableZoomInteraction
          cooldownTicks={80}
        />
      </div>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Edges connect companies competing in the same NAICS industry · Hover a node for details
        <span className="ml-2 italic text-amber-500">— sample data, 2010</span>
      </p>
    </div>
  );
}
