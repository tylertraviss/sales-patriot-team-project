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
import VendorAvgContractSize from './VendorAvgContractSize';
import VendorYoYSparkline from './VendorYoYSparkline';
import VendorAwardTypeDonut from './VendorAwardTypeDonut';
import VendorNaicsChart from './VendorNaicsChart';
import VendorStateChart from './VendorStateChart';
import { getVendor, getVendorSummary, getWinRate } from '@/services/vendors';

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

export default function VendorDetailDrawer({ cageCode, vendorName, open, onOpenChange }) {
  const [vendor, setVendor] = useState(null);
  const [summary, setSummary] = useState(null);
  const [winRate, setWinRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !cageCode) return;
    setVendor(null);
    setSummary(null);
    setWinRate(null);
    setError(null);
    setLoading(true);

    Promise.allSettled([
      getVendor(cageCode),
      getVendorSummary(cageCode),
      getWinRate(cageCode),
    ]).then(([vRes, sRes, wrRes]) => {
      if (vRes.status  === 'fulfilled') setVendor(vRes.value);
      if (sRes.status  === 'fulfilled') setSummary(sRes.value);
      if (wrRes.status === 'fulfilled') setWinRate(wrRes.value);
      if (vRes.status === 'rejected' && sRes.status === 'rejected') {
        setError('Failed to load vendor data.');
      }
      setLoading(false);
    });
  }, [open, cageCode]);

  const spendByYear   = summary?.byYear         ?? [];
  const byAgency      = summary?.byAgency        ?? [];
  const byCompetition = summary?.byCompetition   ?? [];
  const byAwardType   = summary?.byAwardType     ?? [];
  const byNaics       = summary?.byNaics         ?? [];
  const byState       = summary?.byState         ?? [];

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
            {cageCode && <Badge variant="outline" className="font-mono text-xs">CAGE: {cageCode}</Badge>}
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

            {/* YoY growth sparkline — top of analytics */}
            {spendByYear.length >= 2 && (
              <VendorYoYSparkline data={spendByYear} />
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

            {/* Avg contract size */}
            {spendByYear.length > 1 && (
              <>
                <Separator />
                <Section title="Avg Contract Size by Year">
                  <VendorAvgContractSize data={spendByYear} />
                </Section>
              </>
            )}

            {/* Award type breakdown */}
            {byAwardType.length > 0 && (
              <>
                <Separator />
                <Section title="Award Type Breakdown">
                  <VendorAwardTypeDonut data={byAwardType} />
                </Section>
              </>
            )}

            {/* NAICS breakdown */}
            {byNaics.length > 0 && (
              <>
                <Separator />
                <Section title="Top NAICS Codes">
                  <VendorNaicsChart data={byNaics} />
                </Section>
              </>
            )}

            {/* Place of performance */}
            {byState.length > 0 && (
              <>
                <Separator />
                <Section title="Place of Performance">
                  <VendorStateChart data={byState} />
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
              <VendorAwardsTable cageCode={cageCode} />
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
