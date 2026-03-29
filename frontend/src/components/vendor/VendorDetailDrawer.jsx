import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import VendorProfile from './VendorProfile';
import VendorSpendChart from './VendorSpendChart';
import VendorAgencyChart from './VendorAgencyChart';
import VendorCompetitionChart from './VendorCompetitionChart';
import VendorAwardsTable from './VendorAwardsTable';
import { getVendor, getVendorSummary } from '@/services/vendors';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

export default function VendorDetailDrawer({ cageCode, vendorName, open, onOpenChange }) {
  const [vendor, setVendor] = useState(null);
  const [summary, setSummary] = useState(null);
  const [resolvedCageCode, setResolvedCageCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || (!cageCode && !vendorName)) return;
    setVendor(null);
    setSummary(null);
    setResolvedCageCode(null);
    setError(null);
    setLoading(true);

    async function resolveCageCode(candidate, name) {
      // 1. Try the candidate directly
      if (candidate) {
        try {
          const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
          const res  = await fetch(`${BASE}/vendors/${candidate}`);
          if (res.ok) return candidate; // it's a valid cage_code
        } catch { /* fall through */ }
      }
      // 2. Fall back to name search
      if (name) {
        try {
          const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
          const res  = await fetch(`${BASE}/vendors?search=${encodeURIComponent(name)}&limit=5`);
          if (res.ok) {
            const json  = await res.json();
            const match = (json.data ?? []).find(
              (v) => v.name?.toUpperCase() === name.toUpperCase()
            ) ?? json.data?.[0];
            if (match?.cage_code) return match.cage_code;
          }
        } catch { /* fall through */ }
      }
      return null;
    }

    async function load() {
      const resolvedCage = await resolveCageCode(cageCode, vendorName);

      if (!resolvedCage) {
        setLoading(false);
        return;
      }

      setResolvedCageCode(resolvedCage);
      const [vRes, sRes] = await Promise.allSettled([
        getVendor(resolvedCage),
        getVendorSummary(resolvedCage),
      ]);
      if (vRes.status === 'fulfilled') setVendor(vRes.value);
      if (sRes.status === 'fulfilled') setSummary(sRes.value);
      if (vRes.status === 'rejected' && sRes.status === 'rejected') {
        setError('No profile found for this vendor.');
      }
      setLoading(false);
    }

    load();
  }, [open, cageCode, vendorName]);

  function extract(key, ...fallbacks) {
    if (!summary) return [];
    for (const k of [key, ...fallbacks]) {
      if (Array.isArray(summary[k]) && summary[k].length) return summary[k];
    }
    return [];
  }

  const spendByYear   = extract('byYear', 'spendByYear', 'yearlySpend', 'byFiscalYear');
  const byAgency      = extract('byAgency', 'agencyBreakdown', 'agencies');
  const byCompetition = extract('byCompetition', 'competitionBreakdown', 'extentCompeted');

  // Backend returns snake_case fields — support both
  const totalObligated = vendor?.total_obligated ?? vendor?.totalObligated ?? summary?.totalObligated ?? null;
  const awardCount     = vendor?.award_count ?? vendor?.awardCount ?? summary?.awardCount ?? null;

  // Display name — backend returns `name`, fallback to prop
  const displayName = vendorName ?? vendor?.name ?? vendor?.vendor_name ?? cageCode;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-6 pt-10">

        {/* Header — use a div instead of SheetDescription to avoid <p> nesting warning */}
        <SheetHeader className="space-y-1 pr-6">
          <SheetTitle className="text-xl leading-tight">{displayName}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            {vendor?.uei && (
              <Badge variant="outline" className="font-mono text-xs">{vendor.uei}</Badge>
            )}
            {(vendor?.cage_code ?? vendor?.cageCode) && (
              <Badge variant="outline" className="font-mono text-xs">
                CAGE: {vendor.cage_code ?? vendor.cageCode}
              </Badge>
            )}
            {(vendor?.state_code ?? vendor?.stateCode) && (
              <span className="text-xs">{vendor.state_code ?? vendor.stateCode}</span>
            )}
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-destructive text-center py-8">{error}</p>
        )}

        {!loading && !error && (
          <>
            {/* KPI row */}
            {(totalObligated !== null || awardCount !== null) && (
              <div className="grid grid-cols-2 gap-3">
                {totalObligated !== null && (
                  <StatCard label="Total Obligated" value={fmt.format(Number(totalObligated))} />
                )}
                {awardCount !== null && (
                  <StatCard label="Total Awards" value={Number(awardCount).toLocaleString()} />
                )}
              </div>
            )}

            {/* Identity + certifications */}
            {vendor && (
              <>
                <Separator />
                <Section title="Vendor Profile">
                  <VendorProfile vendor={vendor} />
                </Section>
              </>
            )}

            {/* Spend over time */}
            {spendByYear.length > 0 && (
              <>
                <Separator />
                <Section title="Spend by Fiscal Year">
                  <VendorSpendChart data={spendByYear} />
                </Section>
              </>
            )}

            {/* Agency breakdown */}
            {byAgency.length > 0 && (
              <>
                <Separator />
                <Section title="Top Agencies">
                  <VendorAgencyChart data={byAgency} />
                </Section>
              </>
            )}

            {/* Competition breakdown */}
            {byCompetition.length > 0 && (
              <>
                <Separator />
                <Section title="Competition Rate">
                  <VendorCompetitionChart data={byCompetition} />
                </Section>
              </>
            )}

            {/* Individual awards */}
            {resolvedCageCode && (
              <>
                <Separator />
                <Section title="Contract Awards">
                  <VendorAwardsTable cageCode={resolvedCageCode} />
                </Section>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
