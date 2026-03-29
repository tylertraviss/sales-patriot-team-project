import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 shadow-md text-xs">
      <p className="font-semibold">FY {label}</p>
      <p className={val >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        {val >= 0 ? '+' : ''}{val.toFixed(1)}% YoY
      </p>
    </div>
  );
}

export default function VendorYoYSparkline({ data }) {
  if (!data?.length) return null;

  const sorted = [...data]
    .map((d) => ({
      year:  d.fiscalYear ?? d.fiscal_year ?? d.year,
      total: Number(d.totalObligated ?? d.total_obligated ?? 0),
    }))
    .filter((d) => d.year)
    .sort((a, b) => Number(a.year) - Number(b.year));

  if (sorted.length < 2) return null;

  const chartData = sorted.slice(1).map((d, i) => {
    const prev = sorted[i].total;
    const pct  = prev > 0 ? ((d.total - prev) / prev) * 100 : 0;
    return { year: d.year, pct: parseFloat(pct.toFixed(1)) };
  });

  const latest    = chartData[chartData.length - 1];
  const isPos     = latest.pct >= 0;
  const color     = isPos ? '#10b981' : '#ef4444';
  const posYears  = chartData.filter((d) => d.pct >= 0).length;
  const negYears  = chartData.length - posYears;

  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          YoY Revenue Growth
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="text-emerald-600 font-medium">{posYears} up</span>
          <span className="text-red-500 font-medium">{negYears} down</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPos ? '+' : ''}{latest.pct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">most recent year</p>
        </div>

        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height={56}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="yoyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
              <Area
                dataKey="pct"
                stroke={color}
                strokeWidth={1.5}
                fill="url(#yoyGrad)"
                dot={false}
                activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
