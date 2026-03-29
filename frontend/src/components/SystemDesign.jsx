
const PAGES = [
  { name: 'Dashboard',       desc: 'KPIs, top earners, spend by state/NAICS' },
  { name: 'Vendors',         desc: 'Table, 3D globe, map — filter by 5+ dimensions' },
  { name: 'Sector Graph',    desc: 'Force-directed NAICS ↔ vendor network' },
  { name: 'Opportunities',   desc: '10-chart analytics workspace' },
  { name: 'Agent',           desc: 'Streaming AI chat with live DB context' },
];

const API_GROUPS = [
  { label: '/api/dashboard',  color: 'bg-blue-100 text-blue-700',   desc: '5 endpoints — KPIs, earners, NAICS, state, type' },
  { label: '/api/vendors',    color: 'bg-indigo-100 text-indigo-700', desc: '6 endpoints — list, detail, awards, summary' },
  { label: '/api/analytics',  color: 'bg-violet-100 text-violet-700', desc: '16 endpoints — scores, heatmap, moat, win-rate' },
  { label: '/api/awards',     color: 'bg-sky-100 text-sky-700',      desc: '2 endpoints — paginated feed, headers' },
  { label: '/api/naics',      color: 'bg-cyan-100 text-cyan-700',    desc: '2 endpoints — list, force-graph data' },
  { label: '/api/agent',      color: 'bg-orange-100 text-orange-700', desc: 'POST chat — SSE stream → OpenRouter' },
];

const DB_TABLES = [
  { name: 'award_transactions', note: '10M+ rows — core fact table', type: 'fact' },
  { name: 'vendor_entities',    note: '~10K vendors, CAGE + UEI keys', type: 'dim' },
  { name: 'naics_codes',        note: 'Industry sector definitions', type: 'dim' },
  { name: 'vendor_investment_summary', note: 'Materialized — lifetime aggregates + YoY', type: 'view' },
  { name: 'vendor_year_metrics',       note: 'Materialized — year × vendor aggregates', type: 'view' },
];

const STACK = [
  { label: 'React 18 + Vite', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { label: 'Tailwind CSS',    color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { label: 'Recharts + D3',   color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'Node / Express',  color: 'bg-green-50 text-green-700 border-green-200' },
  { label: 'PostgreSQL',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'OpenRouter AI',   color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

const typeStyle = {
  fact: 'bg-violet-100 text-violet-700',
  dim:  'bg-blue-100 text-blue-700',
  view: 'bg-emerald-100 text-emerald-700',
};


export default function SystemDesign() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Architecture</h1>
        <p className="text-sm text-gray-400 mt-0.5">Sales Patriot — federal contracting intelligence platform</p>
      </div>

      <div className="space-y-6">

          {/* Tech stack */}
          <div className="flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span key={s.label} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.color}`}>
                {s.label}
              </span>
            ))}
          </div>

          {/* Three-tier diagram */}
          <div className="flex items-stretch gap-0">

            {/* Frontend */}
            <div className="flex-1 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Frontend</span>
                <span className="text-xs text-blue-400">React + Vite · Port 5173</span>
              </div>

              <div className="space-y-1.5">
                {PAGES.map((p) => (
                  <div key={p.name} className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                    <p className="text-xs font-semibold text-gray-800">{p.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{p.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 bg-white rounded-lg px-3 py-2 border border-orange-200">
                <p className="text-xs font-semibold text-orange-700">OpenRouter SSE Stream</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Agent tab streams Claude 3.5 Sonnet responses token by token via Server-Sent Events</p>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-[10px] text-blue-500 font-medium mb-1.5">services/api.js — 30+ typed fetch functions</p>
                <div className="flex flex-wrap gap-1">
                  {['Axios', 'snake→camel', 'Promise.all', 'Mock toggle'].map((t) => (
                    <span key={t} className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center mx-2">
              <div className="flex flex-col items-center gap-1">
                <svg width="40" height="14" viewBox="0 0 40 14" fill="none">
                  <path d="M0 4h32M0 10h32" stroke="#9ca3af" strokeWidth="1.3" />
                  <path d="M32 0l8 7-8 7" fill="#d1d5db" />
                </svg>
                <span className="text-[9px] text-gray-400 text-center leading-tight">HTTP<br/>JSON</span>
              </div>
            </div>

            {/* Backend */}
            <div className="flex-1 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Backend</span>
                <span className="text-xs text-green-400">Express.js · Port 4000</span>
              </div>

              <div className="space-y-1.5">
                {API_GROUPS.map((r) => (
                  <div key={r.label} className="bg-white rounded-lg px-3 py-2 border border-green-100">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.color}`}>{r.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{r.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-[10px] text-green-600 font-medium mb-1.5">Middleware + Infrastructure</p>
                <div className="flex flex-wrap gap-1">
                  {['CORS', 'Winston logs', 'Error handler', 'Request IDs', 'pg pool'].map((t) => (
                    <span key={t} className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center mx-2">
              <div className="flex flex-col items-center gap-1">
                <svg width="40" height="14" viewBox="0 0 40 14" fill="none">
                  <path d="M0 4h32M0 10h32" stroke="#9ca3af" strokeWidth="1.3" />
                  <path d="M32 0l8 7-8 7" fill="#d1d5db" />
                </svg>
                <span className="text-[9px] text-gray-400 text-center leading-tight">SQL<br/>pg pool</span>
              </div>
            </div>

            {/* Database */}
            <div className="flex-1 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Database</span>
                <span className="text-xs text-purple-400">PostgreSQL · Port 5432</span>
              </div>

              <div className="space-y-1.5">
                {DB_TABLES.map((t) => (
                  <div key={t.name} className="bg-white rounded-lg px-3 py-2 border border-purple-100">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${typeStyle[t.type]}`}>
                        {t.type}
                      </span>
                      <p className="text-[10px] font-semibold text-gray-700 truncate">{t.name}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{t.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-purple-200">
                <p className="text-[10px] text-purple-600 font-medium mb-1.5">Optimizations</p>
                <div className="flex flex-wrap gap-1">
                  {['TRGM index', 'GIN JSONB', 'Composite keys', 'Mat. views', '~200GB'].map((t) => (
                    <span key={t} className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data flow strip */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Key Data Flows</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">CSV Ingestion</p>
                <div className="flex items-center gap-1 flex-wrap text-[10px] text-gray-500">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">Upload.jsx</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">Multer</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">awardsIngest.js</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">vendor_entities</span>
                  <span>+</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">award_transactions</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Vendor Deep Dive</p>
                <div className="flex items-center gap-1 flex-wrap text-[10px] text-gray-500">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">Click row</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">Promise.all(3)</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">vendor + summary + win-rate</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">Drawer + charts</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Agent Chat</p>
                <div className="flex items-center gap-1 flex-wrap text-[10px] text-gray-500">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">User prompt</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">buildContextBlock()</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">OpenRouter</span>
                  <span>→</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">SSE stream</span>
                </div>
              </div>
            </div>
          </div>

      </div>
    </div>
  );
}
