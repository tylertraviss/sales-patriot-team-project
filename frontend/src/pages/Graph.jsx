import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import VendorDetailDrawer from '@/components/vendor/VendorDetailDrawer';
import { cn } from '@/lib/utils';

const NaicsGraph = lazy(() => import('@/components/NaicsGraph'));

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const PAGES               = 5;   // pages × 100 awards for NAICS graph
const TOP_SECTORS         = 8;
const MAX_VENDORS_PER_SECTOR = 15;
const TOP_AGENCIES        = 10;  // agencies to include in agency graph
const MAX_VENDORS_PER_AGENCY = 12;

// ─────────────────────────────────────────────────────────────────────────────
// NAICS graph — built from /api/awards
// ─────────────────────────────────────────────────────────────────────────────
function buildNaicsGraph(awards) {
  const vendorMap = {};
  const sectorMap = {};

  for (const a of awards) {
    const uei   = a.vendor_uei;
    const name  = a.vendor_name ?? uei;
    const amt   = Number(a.dollars_obligated ?? 0);
    const naics = a.naics_code;
    const ndesc = a.naics_description ?? naics;
    const ec    = (a.extent_competed_name ?? '').toUpperCase();

    if (!uei || !naics) continue;

    if (!vendorMap[uei]) vendorMap[uei] = { name, cage_code: a.vendor_cage ?? null, totalObligated: 0, awardCount: 0, competed: 0, soleSource: 0, naics: new Set() };
    if (!vendorMap[uei].cage_code && a.vendor_cage) vendorMap[uei].cage_code = a.vendor_cage;
    vendorMap[uei].totalObligated += amt;
    vendorMap[uei].awardCount    += 1;
    vendorMap[uei].naics.add(naics);
    if (ec.includes('FULL AND OPEN'))                                       vendorMap[uei].competed   += 1;
    else if (ec.includes('NOT COMPETED') || ec.includes('NOT AVAILABLE'))   vendorMap[uei].soleSource += 1;

    if (!sectorMap[naics]) sectorMap[naics] = { name: ndesc, totalObligated: 0, awardCount: 0, vendors: new Set() };
    sectorMap[naics].totalObligated += amt;
    sectorMap[naics].awardCount    += 1;
    sectorMap[naics].vendors.add(uei);
  }

  const topSectors     = Object.entries(sectorMap).sort((a, b) => b[1].totalObligated - a[1].totalObligated).slice(0, TOP_SECTORS).map(([code, s]) => ({ code, ...s }));
  const topSectorCodes = new Set(topSectors.map((s) => s.code));

  const vendorSectorSpend = {};
  for (const a of awards) {
    if (!a.vendor_uei || !a.naics_code) continue;
    const k = `${a.vendor_uei}_${a.naics_code}`;
    vendorSectorSpend[k] = (vendorSectorSpend[k] ?? 0) + Number(a.dollars_obligated ?? 0);
  }

  const includedVendors = new Set();
  for (const sector of topSectors) {
    [...sector.vendors]
      .map((uei) => ({ uei, spend: vendorSectorSpend[`${uei}_${sector.code}`] ?? 0 }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, MAX_VENDORS_PER_SECTOR)
      .forEach((v) => includedVendors.add(v.uei));
  }

  const nodes = [
    ...topSectors.map((s) => ({
      id: `naics_${s.code}`, label: s.name, shortLabel: s.code,
      type: 'naics', naicsCode: s.code,
      vendorCount: s.vendors.size, totalObligated: s.totalObligated,
    })),
    ...[...includedVendors].map((uei) => {
      const v           = vendorMap[uei];
      const total       = v.awardCount;
      const solePct     = total ? Math.round((v.soleSource / total) * 100) : 0;
      const competedPct = total ? Math.round((v.competed   / total) * 100) : 0;
      return {
        id: `vendor_${uei}`, label: v.name, type: 'vendor',
        uei,
        cageCode: v.cage_code ?? null,   // may be null for award-only vendors
        vendorName: v.name,
        totalObligated: v.totalObligated,
        awardCount: v.awardCount, soleSourcePct: solePct, competedPct,
        competition: solePct >= 50 ? 'sole' : competedPct >= 50 ? 'competed' : 'mixed',
      };
    }),
  ];

  const links = [];
  for (const uei of includedVendors) {
    for (const naics of vendorMap[uei].naics) {
      if (topSectorCodes.has(naics)) {
        links.push({ source: `naics_${naics}`, target: `vendor_${uei}`, value: vendorSectorSpend[`${uei}_${naics}`] ?? 0 });
      }
    }
  }

  const sectors = topSectors.map((s) => ({ code: s.code, description: s.name, vendorCount: s.vendors.size, totalObligated: s.totalObligated }));
  return { nodes, links, sectors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agency graph — built from /api/agencies + /api/agencies/:code/vendors
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAgencyGraph() {
  // Fetch top agencies
  const agRes   = await fetch(`${BASE_URL}/agencies?limit=${TOP_AGENCIES}&sort=total_obligated&order=desc`);
  if (!agRes.ok) throw new Error(`${agRes.status} ${agRes.statusText}`);
  const agData  = await agRes.json();
  const agencies = agData.data ?? [];

  // Fetch vendors for each agency in parallel
  const vendorResults = await Promise.all(
    agencies.map((ag) =>
      fetch(`${BASE_URL}/agencies/${ag.code}/vendors?limit=${MAX_VENDORS_PER_AGENCY}&sort=total_obligated&order=desc`)
        .then((r) => r.ok ? r.json() : { data: [] })
        .then((d) => ({ code: ag.code, vendors: d.data ?? [] }))
    )
  );

  // Build vendor map — a vendor may appear under multiple agencies
  const vendorMap = {};
  for (const { vendors } of vendorResults) {
    for (const v of vendors) {
      const id = v.cage_code ?? v.uei;
      if (!id) continue;
      if (!vendorMap[id]) {
        vendorMap[id] = {
          name          : v.name,
          cage_code     : v.cage_code,
          uei           : v.uei,
          state_code    : v.state_code,
          totalObligated: 0,
          awardCount    : 0,
          // socio_economic_indicator used for competition proxy
          sei           : v.socio_economic_indicator ?? '',
        };
      }
      vendorMap[id].totalObligated += Number(v.total_obligated ?? 0);
      vendorMap[id].awardCount    += Number(v.award_count ?? 0);
    }
  }

  const nodes = [
    // Agency hub nodes
    ...agencies.map((ag) => ({
      id            : `agency_${ag.code}`,
      label         : ag.name ?? ag.code,
      shortLabel    : ag.code,
      type          : 'naics',   // reuse 'naics' type so NaicsGraph styles them as amber hubs
      naicsCode     : ag.code,
      vendorCount   : Number(ag.award_count ?? 0),
      totalObligated: Number(ag.total_obligated ?? 0),
    })),
    // Vendor nodes
    ...Object.entries(vendorMap).map(([id, v]) => ({
      id            : `vendor_${id}`,
      label         : v.name,
      vendorName    : v.name,
      type          : 'vendor',
      uei           : v.uei,
      cageCode      : v.cage_code,   // always present from agency/vendors endpoint
      state_code    : v.state_code,
      totalObligated: v.totalObligated,
      awardCount    : v.awardCount,
      // No competition data from this endpoint — use sei as proxy
      competition   : v.sei.toUpperCase().includes('SMALL BUSINESS') ? 'sole' : 'mixed',
      soleSourcePct : 0,
      competedPct   : 0,
    })),
  ];

  // Links — agency → vendor
  const links = [];
  for (const { code, vendors } of vendorResults) {
    for (const v of vendors) {
      const id = v.cage_code ?? v.uei;
      if (id) links.push({ source: `agency_${code}`, target: `vendor_${id}`, value: Number(v.total_obligated ?? 0) });
    }
  }

  // Sector pills for filter UI (using agencies as "sectors")
  const sectors = agencies.map((ag) => ({
    code       : ag.code,
    description: ag.name ?? ag.code,
    vendorCount: vendorResults.find((r) => r.code === ag.code)?.vendors.length ?? 0,
  }));

  return { nodes, links, sectors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Graph() {
  const [mode, setMode]               = useState('naics');    // 'naics' | 'agency'
  const [rawGraph, setRawGraph]       = useState(null);
  const [naicsRaw, setNaicsRaw]       = useState(null);       // cached NAICS graph
  const [agencyRaw, setAgencyRaw]     = useState(null);       // cached agency graph
  const [sectors, setSectors]         = useState([]);
  const [selectedSector, setSelected] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);

  async function loadNaics() {
    if (naicsRaw) { setRawGraph(naicsRaw.graph); setSectors(naicsRaw.sectors); return; }
    setLoading(true); setError(null);
    try {
      const pages = await Promise.all(
        Array.from({ length: PAGES }, (_, i) =>
          fetch(`${BASE_URL}/awards?page=${i + 1}&limit=100&sort=dollars_obligated&order=desc`)
            .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
        )
      );
      const allAwards = pages.flatMap((p) => p.data ?? []);
      const { nodes, links, sectors: s } = buildNaicsGraph(allAwards);
      setRawGraph({ nodes, links });
      setSectors(s);
      setNaicsRaw({ graph: { nodes, links }, sectors: s });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadAgency() {
    if (agencyRaw) { setRawGraph(agencyRaw.graph); setSectors(agencyRaw.sectors); return; }
    setLoading(true); setError(null);
    try {
      const { nodes, links, sectors: s } = await fetchAgencyGraph();
      setRawGraph({ nodes, links });
      setSectors(s);
      setAgencyRaw({ graph: { nodes, links }, sectors: s });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    setRawGraph(null);
    setSelected(null);
    if (mode === 'naics')  loadNaics();
    else                   loadAgency();
  }, [mode]);

  const graphData = useMemo(() => {
    if (!rawGraph) return null;
    if (!selectedSector) {
      return { nodes: rawGraph.nodes.map((n) => ({ ...n })), links: rawGraph.links.map((l) => ({ ...l })) };
    }
    const hubId     = mode === 'naics' ? `naics_${selectedSector}` : `agency_${selectedSector}`;
    const linkedIds = new Set(
      rawGraph.links
        .filter((l) => l.source === hubId || l.target === hubId)
        .map((l) => (l.source === hubId ? l.target : l.source))
    );
    return {
      nodes: rawGraph.nodes.filter((n) => n.id === hubId || linkedIds.has(n.id)).map((n) => ({ ...n })),
      links: rawGraph.links.filter((l) => l.source === hubId || l.target === hubId).map((l) => ({ ...l })),
    };
  }, [rawGraph, selectedSector, mode]);

  const nodeCount   = graphData?.nodes?.length ?? 0;
  const vendorCount = graphData?.nodes?.filter((n) => n.type === 'vendor').length ?? 0;
  const linkCount   = graphData?.links?.length ?? 0;

  const hubLabel = mode === 'naics' ? 'sector' : 'agency';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Competitor Network</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {mode === 'naics'
              ? <>Force-directed graph of vendors grouped by NAICS sector, built from live contract awards. <span className="text-emerald-400 font-medium">Green</span> = mostly sole-source, <span className="text-rose-400 font-medium">red</span> = mostly competed.</>
              : <>Agency → vendor spend web. Each amber hub is a contracting agency; vendor nodes show who receives their contracts. Node size = total obligated.</>
            }
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center rounded-lg border bg-muted p-1 gap-1 shrink-0">
          <button
            onClick={() => setMode('naics')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              mode === 'naics' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            By Sector
          </button>
          <button
            onClick={() => setMode('agency')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              mode === 'agency' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            By Agency
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Filter by {hubLabel} — click to isolate, click again to show all
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
            All {hubLabel}s
          </button>
          {sectors.map((s) => (
            <button
              key={s.code}
              onClick={() => setSelected((prev) => (prev === s.code ? null : s.code))}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                selectedSector === s.code
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              )}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              {s.description.length > 32 ? s.description.slice(0, 32) + '…' : s.description}
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

      {loading && (
        <div className="flex items-center justify-center h-[600px] rounded-xl bg-[#080d1a]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-center h-64 rounded-xl border border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && graphData && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[600px] rounded-xl bg-[#080d1a]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }>
          <NaicsGraph
            key={`${mode}-${selectedSector ?? 'all'}`}
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
