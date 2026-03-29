import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import VendorProfile from './VendorProfile';
import VendorSpendChart from './VendorSpendChart';
import VendorAgencyChart from './VendorAgencyChart';
import VendorCompetitionChart from './VendorCompetitionChart';
import VendorAwardsTable from './VendorAwardsTable';
import {
  getVendor,
  getVendorById,
  getVendorSummary,
  getVendorSummaryById,
  getWinRate,
} from '@/services/vendors';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function VendorDetailDrawer({ cageCode, vendorId, vendorName, open, onOpenChange }) {
  const [vendor, setVendor] = useState(null);
  const [summary, setSummary] = useState(null);
  const [winRate, setWinRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || (!cageCode && !vendorId)) return;
    setVendor(null);
    setSummary(null);
    setWinRate(null);
    setError(null);
    setLoading(true);

    const identity = vendorId || cageCode;
    const vendorLoader = vendorId ? getVendorById : getVendor;
    const summaryLoader = vendorId ? getVendorSummaryById : getVendorSummary;

    Promise.allSettled([
      vendorLoader(identity),
      summaryLoader(identity),
      cageCode ? getWinRate(cageCode) : Promise.resolve(null),
    ]).then(([vRes, sRes, wrRes]) => {
      if (vRes.status  === 'fulfilled') setVendor(vRes.value);
      if (sRes.status  === 'fulfilled') setSummary(sRes.value);
      if (wrRes.status === 'fulfilled') setWinRate(wrRes.value);
      if (vRes.status === 'rejected' && sRes.status === 'rejected') {
        setError('Failed to load vendor data.');
      }
      setLoading(false);
    });
  }, [open, cageCode, vendorId]);

  const spendByYear   = summary?.byYear         ?? [];
  const byAgency      = summary?.byAgency        ?? [];
  const byCompetition = summary?.byCompetition   ?? [];

  const totalObligated = vendor?.totalObligated ?? summary?.totalObligated ?? null;
  const awardCount     = vendor?.awardCount     ?? summary?.awardCount     ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-6 pt-10">

        {/* Header */}
        <SheetHeader className="space-y-1 pr-6">
          <SheetTitle className="text-xl leading-tight">
            {vendorName ?? vendor?.name ?? cageCode}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            {vendor?.uei && <Badge variant="outline" className="font-mono text-xs">UEI: {vendor.uei}</Badge>}
            {vendor?.cageCode && <Badge variant="outline" className="font-mono text-xs">CAGE: {vendor.cageCode}</Badge>}
            {vendor?.stateCode && <span className="text-xs">{vendor.stateCode}</span>}
          </SheetDescription>
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
                  <VendorProfile vendor={vendor} winRate={winRate} />
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
            <Separator />
            <Section title="Contract Awards">
              <VendorAwardsTable cageCode={cageCode} vendorId={vendorId ?? vendor?.vendorId} />
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
