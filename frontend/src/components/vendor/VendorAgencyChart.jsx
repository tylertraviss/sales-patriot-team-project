

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fmtFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const COLORS = [
  'hsl(221.2 83.2% 53.3%)',
  'hsl(221.2 83.2% 63.3%)',
  'hsl(221.2 83.2% 73.3%)',
  'hsl(221.2 83.2% 43.3%)',
  'hsl(221.2 83.2% 33.3%)',
];

const EXPLANATION =
  'Which government agencies awarded contracts to this vendor, and how much. ' +
  'Each bar = total dollars obligated by that agency to this vendor. ' +
  'A vendor spread across many agencies carries less buyer-concentration risk than one dependent on a single agency.';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm max-w-[240px]">
      <p className="font-semibold mb-0.5 leading-snug">{d.name}</p>
      {d.code && d.code !== d.name && (
        <p className="text-xs text-muted-foreground mb-1 font-mono">Code: {d.code}</p>
      )}
      <p className="text-primary font-medium">{fmtFull.format(payload[0].value)}</p>
      {d.awardCount !== undefined && (
        <p className="text-muted-foreground text-xs mt-0.5">{d.awardCount} contract{d.awardCount !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

export default function VendorAgencyChart({ data }) {
  if (!data?.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">No agency breakdown available.</p>
  );

  const chartData = data
    .map((d) => ({
      name: d.agencyName ?? d.agency_name ?? d.agencyCode ?? d.agency_code ?? 'Unknown',
      code: d.agencyCode ?? d.agency_code,
      total: Number(d.totalObligated ?? d.total_obligated ?? d.dollarsObligated ?? 0),
      awardCount: d.awardCount ?? d.award_count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const truncate = (s, n = 26) => s.length > n ? s.slice(0, n) + '…' : s;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">Spend by Agency</p>
            {/* (?) tooltip */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center justify-center h-4 w-4 rounded-full border border-muted-foreground/40 text-muted-foreground/60 text-[10px] font-bold hover:border-muted-foreground hover:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="About this chart"
              >
                ?
              </button>
              <div className="absolute left-0 bottom-full mb-2 z-50 hidden group-hover:block w-64 rounded-lg border bg-popover px-3 py-2 shadow-lg text-xs text-popover-foreground leading-relaxed pointer-events-none">
                <p className="font-semibold mb-1">What am I looking at?</p>
                <p>{EXPLANATION}</p>
                <div className="absolute left-3 top-full border-4 border-transparent border-t-border" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total dollars obligated by each contracting agency · top {chartData.length}
          </p>
        </div>
      </div>

      {/* Agency rows — plain divs, no recharts Y-axis clipping issues */}
      <div className="space-y-2.5">
        {chartData.map((d, i) => {
          const pct = (d.total / chartData[0].total) * 100;
          return (
            <div key={d.code ?? d.name} className="space-y-1">
              {/* Label row */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="inline-block h-2 w-2 rounded-sm shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate font-medium text-foreground" title={d.name}>
                    {truncate(d.name)}
                  </span>
                  {d.code && d.code !== d.name && (
                    <span className="font-mono text-muted-foreground shrink-0">({d.code})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                  <span className="tabular-nums font-semibold text-foreground">{fmt.format(d.total)}</span>
                  {d.awardCount !== undefined && (
                    <span className="text-muted-foreground">{d.awardCount} award{d.awardCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              {/* Bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-1">$ Obligated — bar width relative to top agency</p>
    </div>
  );
}
