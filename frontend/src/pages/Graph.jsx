import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mockGetNaicsGraph } from '@/services/mockApi';
import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import { cn } from '@/lib/utils';

const NaicsGraph = lazy(() => import('@/components/NaicsGraph'));

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function Graph() {
  // Raw full graph — fetched once, never mutated
  const [rawGraph, setRawGraph]       = useState(null);
  const [sectors, setSectors]         = useState([]);
  const [selectedSector, setSelected] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);

  // Fetch full graph once on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let data;
        if (USE_MOCK) {
          data = await mockGetNaicsGraph({});          // no filter → full graph
        } else {
          const res = await fetch(`${BASE_URL}/naics/graph`);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          data = await res.json();
        }
        setRawGraph({ nodes: data.nodes, links: data.links });
        if (data.sectors?.length) setSectors(data.sectors);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derive visible graph from raw — deep copy every time so force-graph
  // never mutates the source (it replaces link.source/target strings with objects)
  const graphData = useMemo(() => {
    if (!rawGraph) return null;
    if (!selectedSector) {
      return {
        nodes: rawGraph.nodes.map((n) => ({ ...n })),
        links: rawGraph.links.map((l) => ({ ...l })),
      };
    }
    const sectorId = `naics_${selectedSector}`;
    const linkedIds = new Set(
      rawGraph.links
        .filter((l) => l.source === sectorId || l.target === sectorId)
        .map((l) => (l.source === sectorId ? l.target : l.source))
    );
    return {
      nodes: rawGraph.nodes
        .filter((n) => n.id === sectorId || linkedIds.has(n.id))
        .map((n) => ({ ...n })),
      links: rawGraph.links
        .filter((l) => l.source === sectorId || l.target === sectorId)
        .map((l) => ({ ...l })),
    };
  }, [rawGraph, selectedSector]);

  function handleSectorClick(code) {
    setSelected((prev) => (prev === code ? null : code));
  }

  const nodeCount   = graphData?.nodes?.length ?? 0;
  const vendorCount = graphData?.nodes?.filter((n) => n.type === 'vendor').length ?? 0;
  const linkCount   = graphData?.links?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sector Competitor Network</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Force-directed graph of vendors grouped by NAICS sector. Node color shows competition
          profile — <span className="text-emerald-400 font-medium">green</span> = mostly
          sole-source (low competition, strong position),{' '}
          <span className="text-rose-400 font-medium">red</span> = mostly competed.
          Click a vendor node to open its detail panel.
        </p>
      </div>

      {/* Sector filter pills */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Filter by sector — click to isolate, click again to show all
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              selectedSector === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
            )}
          >
            All sectors
          </button>
          {sectors.map((s) => (
            <button
              key={s.code}
              onClick={() => handleSectorClick(s.code)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                selectedSector === s.code
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              )}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              {s.description.length > 30 ? s.description.slice(0, 30) + '…' : s.description}
              <span className="opacity-60">({s.vendorCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!loading && graphData && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{nodeCount}</span> nodes</span>
          <span><span className="font-semibold text-foreground">{vendorCount}</span> vendors</span>
          <span><span className="font-semibold text-foreground">{linkCount}</span> connections</span>
          {selectedSector && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/40 font-mono text-[10px]">
              {selectedSector}
            </Badge>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-[600px] rounded-xl bg-[#080d1a]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center justify-center h-64 rounded-xl border border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Graph — NaicsGraph receives a fresh deep-copied graphData on every filter change */}
      {!loading && !error && graphData && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[600px] rounded-xl bg-[#080d1a]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }>
          <NaicsGraph
            key={selectedSector ?? 'all'}
            graphData={graphData}
            selectedSector={selectedSector}
            onVendorClick={(v) => { setSelectedVendor(v); setDrawerOpen(true); }}
          />
        </Suspense>
      )}

      <VendorDetailDrawer
        uei={selectedVendor?.uei}
        vendorName={selectedVendor?.vendorName}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
