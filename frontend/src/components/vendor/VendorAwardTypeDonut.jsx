import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmtFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum  = new Intl.NumberFormat('en-US');

const TYPE_COLORS = {
  'DEFINITIVE CONTRACT': '#3b82f6',
  'DELIVERY ORDER':      '#10b981',
  'PURCHASE ORDER':      '#f59e0b',
  'BPA CALL':            '#8b5cf6',
};
const FALLBACK_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-semibold mb-1">{d.awardType}</p>
      <p className="text-muted-foreground">{fmtNum.format(d.awardCount)} awards</p>
      <p className="text-primary">{fmtFull.format(Number(d.totalObligated))}</p>
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <ul className="flex flex-col gap-1 text-[10px] text-muted-foreground">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5 truncate">
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
          <span className="truncate">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function VendorAwardTypeDonut({ data }) {
  if (!data?.length) return null;

  const chartData = data.map((d, i) => ({
    ...d,
    awardCount:     Number(d.awardCount),
    totalObligated: Number(d.totalObligated),
    color: TYPE_COLORS[d.awardType] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  const total = chartData.reduce((s, d) => s + d.awardCount, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="awardCount"
              nameKey="awardType"
              innerRadius={42}
              outerRadius={62}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold tabular-nums">{fmtNum.format(total)}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">awards</span>
        </div>
      </div>

      <CustomLegend payload={chartData.map((d) => ({ value: d.awardType, color: d.color }))} />
    </div>
  );
}
