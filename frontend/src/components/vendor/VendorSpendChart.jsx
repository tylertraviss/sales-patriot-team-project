import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const fmt     = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fmtFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// ── Math ─────────────────────────────────────────────────────────────────────
function linReg(values) {
  const n = values.length;
  if (n < 2) return null;
  const sumX  = (n * (n - 1)) / 2;
  const sumY  = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumXX = values.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumXX - sumX * sumX;
  if (!denom) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return (i) => Math.max(0, slope * i + intercept);
}

function calcCAGR(first, last, years) {
  if (!first || !last || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const spend = payload.find((p) => p.dataKey === 'total');
  if (!spend) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-semibold mb-1">FY {label}{d?.projected ? ' (projected)' : ''}</p>
      <p className={d?.projected ? 'text-blue-400' : 'text-primary'}>{fmtFull.format(spend.value)}</p>
      {d?.awardCount > 0 && (
        <p className="text-muted-foreground text-xs">{d.awardCount} awards</p>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VendorSpendChart({ data }) {
  if (!data?.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">No yearly spend data available.</p>
  );

  const historical = data
    .map((d) => ({
      year:       d.fiscalYear ?? d.fiscal_year ?? d.year,
      total:      Number(d.totalObligated ?? d.total_obligated ?? d.dollarsObligated ?? d.dollars_obligated ?? 0),
      awardCount: Number(d.awardCount ?? d.award_count ?? 0),
    }))
    .filter((d) => d.year)
    .sort((a, b) => Number(a.year) - Number(b.year));

  const n       = historical.length;
  const predict = linReg(historical.map((d) => d.total));
  const maxYear = Number(historical[n - 1]?.year ?? 0);
  const cagrPct = calcCAGR(historical[0]?.total, historical[n - 1]?.total, n - 1);

  const allData = [
    ...historical.map((d, i) => ({
      ...d,
      trend:     predict ? predict(i) : undefined,
      projected: false,
    })),
    ...(predict ? [
      { year: maxYear + 1, total: predict(n),     trend: predict(n),     projected: true, awardCount: 0 },
      { year: maxYear + 2, total: predict(n + 1), trend: predict(n + 1), projected: true, awardCount: 0 },
    ] : []),
  ];

  return (
    <div className="space-y-3">
      {cagrPct !== null && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${cagrPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {cagrPct >= 0 ? '+' : ''}{cagrPct.toFixed(1)}% CAGR
          </span>
          <span className="text-muted-foreground">over {n - 1} year{n !== 2 ? 's' : ''}</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={allData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmt.format} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Bar dataKey="total" radius={[3, 3, 0, 0]}>
            {allData.map((d, i) => (
              <Cell
                key={i}
                fill={d.projected ? '#93c5fd' : 'hsl(var(--primary))'}
                fillOpacity={d.projected ? 0.55 : 1}
              />
            ))}
          </Bar>
          {predict && (
            <Line
              dataKey="trend"
              stroke="#f97316"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
          Historical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-300 opacity-60" />
          Projected
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="10">
            <line x1="0" y1="5" x2="16" y2="5" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          Trend
        </span>
      </div>
    </div>
  );
}
