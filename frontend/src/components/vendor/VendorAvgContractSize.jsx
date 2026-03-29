import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const fmt     = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fmtFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-semibold mb-1">FY {label}</p>
      <p className="text-violet-600">{fmtFull.format(payload[0].value)} avg</p>
      {d?.awardCount > 0 && (
        <p className="text-muted-foreground text-xs">{d.awardCount} awards</p>
      )}
    </div>
  );
}

export default function VendorAvgContractSize({ data }) {
  if (!data?.length) return null;

  const chartData = data
    .map((d) => {
      const total = Number(d.totalObligated ?? d.total_obligated ?? 0);
      const count = Number(d.awardCount ?? d.award_count ?? 0);
      return {
        year:       d.fiscalYear ?? d.fiscal_year ?? d.year,
        avg:        count > 0 ? total / count : 0,
        awardCount: count,
      };
    })
    .filter((d) => d.year && d.avg > 0)
    .sort((a, b) => Number(a.year) - Number(b.year));

  if (chartData.length < 2) return null;

  const first = chartData[0].avg;
  const last  = chartData[chartData.length - 1].avg;
  const delta = ((last - first) / first) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">change in avg contract size</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmt.format} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
          <Line
            dataKey="avg"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
