import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import VendorProfile from '@/components/vendor/VendorProfile';
import VendorSpendChart from '@/components/vendor/VendorSpendChart';
import VendorAvgContractSize from '@/components/vendor/VendorAvgContractSize';
import VendorYoYSparkline from '@/components/vendor/VendorYoYSparkline';
import VendorAwardTypeDonut from '@/components/vendor/VendorAwardTypeDonut';
import VendorNaicsChart from '@/components/vendor/VendorNaicsChart';
import VendorStateChart from '@/components/vendor/VendorStateChart';
import VendorAgencyChart from '@/components/vendor/VendorAgencyChart';
import VendorCompetitionChart from '@/components/vendor/VendorCompetitionChart';
import VendorAwardsTable from '@/components/vendor/VendorAwardsTable';
import { getVendor, getVendorSummary, getWinRate } from '@/services/vendors';

const fmtCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtCompact  = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fmtNum      = new Intl.NumberFormat('en-US');

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 ${className}`}>
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">{title}</p>
      )}
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function VendorDetail({ cageCode, vendorName, onBack }) {
  const [vendor,  setVendor]  = useState(null);
  const [summary, setSummary] = useState(null);
  const [winRate, setWinRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!cageCode) return;
    setLoading(true);
    setError(null);

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
  }, [cageCode]);

  const spendByYear   = summary?.byYear        ?? [];
  const byAgency      = summary?.byAgency       ?? [];
  const byCompetition = summary?.byCompetition  ?? [];
  const byAwardType   = summary?.byAwardType    ?? [];
  const byNaics       = summary?.byNaics        ?? [];
  const byState       = summary?.byState        ?? [];

  const totalObligated = Number(summary?.totalObligated ?? vendor?.totalObligated ?? 0);
  const awardCount     = Number(summary?.awardCount     ?? vendor?.awardCount     ?? 0);
  const avgSize        = awardCount > 0 ? totalObligated / awardCount : 0;

  // Latest YoY % for KPI card
  const sortedYears = [...spendByYear]
    .map((d) => ({ year: Number(d.fiscalYear ?? d.year), total: Number(d.totalObligated ?? 0) }))
    .sort((a, b) => a.year - b.year);
  const latestYoY = sortedYears.length >= 2
    ? ((sortedYears.at(-1).total - sortedYears.at(-2).total) / (sortedYears.at(-2).total || 1)) * 100
    : null;

  const name = vendorName ?? vendor?.name ?? cageCode;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vendors
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {vendor?.uei    && <Badge variant="outline" className="font-mono text-xs">UEI: {vendor.uei}</Badge>}
              {cageCode       && <Badge variant="outline" className="font-mono text-xs">CAGE: {cageCode}</Badge>}
              {vendor?.stateCode && <span className="text-xs text-gray-400">{vendor.stateCode}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading / Error ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 text-red-500 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI row ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Obligated"
              value={fmtCompact.format(totalObligated)}
              sub={fmtCurrency.format(totalObligated)}
            />
            <KpiCard
              label="Total Awards"
              value={fmtNum.format(awardCount)}
              sub={`across ${byAgency.length} agenc${byAgency.length === 1 ? 'y' : 'ies'}`}
            />
            <KpiCard
              label="Avg Contract Size"
              value={fmtCompact.format(avgSize)}
              sub="per award"
            />
            {latestYoY !== null && (
              <KpiCard
                label="Latest YoY Growth"
                value={`${latestYoY >= 0 ? '+' : ''}${latestYoY.toFixed(1)}%`}
                sub={`FY${sortedYears.at(-1)?.year} vs FY${sortedYears.at(-2)?.year}`}
                accent={latestYoY >= 0 ? 'text-emerald-600' : 'text-red-500'}
              />
            )}
          </div>

          {/* ── YoY sparkline ─────────────────────────────────────────── */}
          {spendByYear.length >= 2 && (
            <VendorYoYSparkline data={spendByYear} />
          )}

          {/* ── Spend chart + Award type donut ────────────────────────── */}
          {(spendByYear.length > 0 || byAwardType.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {spendByYear.length > 0 && (
                <Card title="Spend by Fiscal Year" className="md:col-span-3">
                  <VendorSpendChart data={spendByYear} />
                </Card>
              )}
              {byAwardType.length > 0 && (
                <Card title="Award Type Breakdown" className="md:col-span-2">
                  <VendorAwardTypeDonut data={byAwardType} />
                </Card>
              )}
            </div>
          )}

          {/* ── Avg contract size ─────────────────────────────────────── */}
          {spendByYear.length > 1 && (
            <Card title="Avg Contract Size by Year">
              <VendorAvgContractSize data={spendByYear} />
            </Card>
          )}

          {/* ── Top NAICS ─────────────────────────────────────────────── */}
          {byNaics.length > 0 && (
            <Card title="Top NAICS Codes">
              <VendorNaicsChart data={byNaics} />
            </Card>
          )}

          {/* ── Place of performance + Vendor profile ─────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {byState.length > 0 && (
              <Card title="Place of Performance">
                <VendorStateChart data={byState} />
              </Card>
            )}
            {vendor && (
              <Card title="Vendor Profile">
                <VendorProfile vendor={vendor} winRate={winRate} />
              </Card>
            )}
          </div>

          {/* ── Agencies + Competition ────────────────────────────────── */}
          {(byAgency.length > 0 || byCompetition.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {byAgency.length > 0 && (
                <Card title="Top Agencies">
                  <VendorAgencyChart data={byAgency} />
                </Card>
              )}
              {byCompetition.length > 0 && (
                <Card title="Competition Rate">
                  <VendorCompetitionChart data={byCompetition} />
                </Card>
              )}
            </div>
          )}

          {/* ── Contract awards table ─────────────────────────────────── */}
          <Card title="Contract Awards">
            <VendorAwardsTable cageCode={cageCode} />
          </Card>
        </>
      )}
    </div>
  );
}
