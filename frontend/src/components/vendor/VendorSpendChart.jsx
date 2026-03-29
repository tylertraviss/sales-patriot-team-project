import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-semibold mb-1">FY {label}</p>
      <p className="text-primary">{fmtFull.format(payload[0].value)}</p>
      {payload[0].payload.awardCount !== undefined && (
        <p className="text-muted-foreground text-xs">{payload[0].payload.awardCount} awards</p>
      )}
    </div>
  );
}

export default function VendorSpendChart({ data }) {
  if (!data?.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">No yearly spend data available.</p>
  );

  // Normalise field names — backend may use camelCase or snake_case
  const chartData = data
    .map((d) => ({
      year: d.fiscalYear ?? d.fiscal_year ?? d.year,
      total: Number(d.totalObligated ?? d.total_obligated ?? d.dollarsObligated ?? d.dollars_obligated ?? 0),
      awardCount: d.awardCount ?? d.award_count,
    }))
    .filter((d) => d.year)
    .sort((a, b) => Number(a.year) - Number(b.year));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={fmt.format}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
