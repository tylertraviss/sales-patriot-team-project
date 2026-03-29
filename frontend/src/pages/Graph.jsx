import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockGetNaicsGraph } from '@/services/mockApi';
import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import { cn } from '@/lib/utils';

const NaicsGraph = lazy(() => import('@/components/NaicsGraph'));

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const SECTOR_OPTIONS             = ['5', '10', '20', '30', '40', '50'];
const VENDORS_PER_SECTOR_OPTIONS = ['5', '10', '15', '20', '25', '30', '40', '50', '75', '100', 'All'];

export default function Graph() {
  const [sectors,        setSectors]        = useState('20');
  const [vendorsPerSector, setVendorsPerSector] = useState('10');

  const [rawGraph,       setRawGraph]       = useState(null);
  const [sectorList,     setSectorList]     = useState([]);
  const [selectedSector, setSelected]       = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [drawerOpen,     setDrawerOpen]     = useState(false);

  // Re-fetch whenever sectors or vendorsPerSector changes
  useEffect(() => {
    setSelected(null);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let data;
        if (USE_MOCK) {
          data = await mockGetNaicsGraph({});
        } else {
          const params = new URLSearchParams({
            sectors,
            vendors_per_sector: vendorsPerSector === 'All' ? '0' : vendorsPerSector,
          });
          const res = await fetch(`${BASE_URL}/naics/graph?${params}`);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          data = await res.json();
        }
        setRawGraph({ nodes: data.nodes, links: data.links });
        if (data.sectors?.length) setSectorList(data.sectors);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sectors, vendorsPerSector]);

  // Derive visible sub-graph when a sector pill is selected
  const graphData = useMemo(() => {
    if (!rawGraph) return null;
    if (!selectedSector) {
      return {
        nodes: rawGraph.nodes.map((n) => ({ ...n })),
        links: rawGraph.links.map((l) => ({ ...l })),
      };
    }
    const sectorId  = `naics_${selectedSector}`;
    const linkedIds = new Set(
      rawGraph.links
        .filter((l) => l.source === sectorId || l.target === sectorId)
        .map((l)   => (l.source === sectorId ? l.target : l.source))
    );
    return {
      nodes: rawGraph.nodes
        .filter((n) => n.id === sectorId || linkedIds.has(n.id))
        .map((n)   => ({ ...n })),
      links: rawGraph.links
        .filter((l) => l.source === sectorId || l.target === sectorId)
        .map((l)   => ({ ...l })),
    };
  }, [rawGraph, selectedSector]);

  function handleSectorClick(code) {
    setSelected((prev) => (prev === code ? null : code));
  }

  const nodeCount   = graphData?.nodes?.length  ?? 0;
  const vendorCount = graphData?.nodes?.filter((n) => n.type === 'vendor').length ?? 0;
  const linkCount   = graphData?.links?.length  ?? 0;

  // Total unique vendors in the full (unfiltered) raw graph
  const totalRawVendors = rawGraph?.nodes?.filter((n) => n.type === 'vendor').length ?? 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sector Competitor Network</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Force-directed graph of vendors grouped by NAICS sector. Node color shows competition
            profile — <span className="text-emerald-400 font-medium">green</span> = mostly
            sole-source, <span className="text-rose-400 font-medium">red</span> = mostly competed.{' '}
            <span className="font-medium text-foreground">Larger clusters = more vendors competing in that sector.</span>{' '}
            Increase the selectors to reveal the full competitive landscape.
          </p>
        </div>

        {/* Selectors */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Sectors</span>
            <Select value={sectors} onValueChange={(v) => setSectors(v)}>
              <SelectTrigger className="w-[70px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SECTOR_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Vendors / sector</span>
            <Select value={vendorsPerSector} onValueChange={(v) => setVendorsPerSector(v)}>
              <SelectTrigger className="w-[70px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {VENDORS_PER_SECTOR_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
          {sectorList.map((s) => (
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
              <span className="opacity-60">({s.vendorCount.toLocaleString()})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {!loading && graphData && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>
            <span className="font-semibold text-foreground">{vendorCount.toLocaleString()}</span> vendors shown
            {!selectedSector && (
              <span className="text-muted-foreground">
                {' '}({sectors} sectors × {vendorsPerSector === 'All' ? 'all' : vendorsPerSector} per sector)
              </span>
            )}
          </span>
          <span><span className="font-semibold text-foreground">{linkCount.toLocaleString()}</span> connections</span>
          {selectedSector && (
            <>
              <span><span className="font-semibold text-foreground">{nodeCount.toLocaleString()}</span> nodes in sector</span>
              <Badge variant="outline" className="text-amber-400 border-amber-400/40 font-mono text-[10px]">
                {selectedSector}
              </Badge>
            </>
          )}
          <span className="text-muted-foreground/50">
            · vendor count in sector pills = all vendors in DB for that sector
          </span>
        </div>
      )}

      {/* Warning for unlimited mode */}
      {vendorsPerSector === 'All' && !loading && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <span className="shrink-0 font-bold">⚠</span>
          <span>
            All vendors per sector selected — this may return thousands of nodes and take significant time to render.
            Consider filtering to a single sector using the pills above.
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 h-[600px] rounded-xl bg-[#080d1a]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-blue-400/70">
            Loading {sectors} sectors × {vendorsPerSector === 'All' ? 'all' : vendorsPerSector} vendors each…
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center justify-center h-64 rounded-xl border border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Graph */}
      {!loading && !error && graphData && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[600px] rounded-xl bg-[#080d1a]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }>
          <NaicsGraph
            key={`${selectedSector ?? 'all'}-${sectors}-${vendorsPerSector}`}
            graphData={graphData}
            selectedSector={selectedSector}
            onVendorClick={(v) => { setSelectedVendor(v); setDrawerOpen(true); }}
          />
        </Suspense>
      )}

      <VendorDetailDrawer
        cageCode={selectedVendor?.cageCode ?? selectedVendor?.uei}
        vendorName={selectedVendor?.vendorName ?? selectedVendor?.label}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
