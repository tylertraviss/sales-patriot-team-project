import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt     = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fmtFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum  = new Intl.NumberFormat('en-US');

const COLORS = [
  '#3b82f6','#60a5fa','#93c5fd','#6366f1','#818cf8',
  '#a78bfa','#c4b5fd','#38bdf8','#7dd3fc','#bae6fd',
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-semibold mb-1">{label || '(Unknown)'}</p>
      <p className="text-primary">{fmtFull.format(Number(d.totalObligated))}</p>
      <p className="text-muted-foreground">{fmtNum.format(Number(d.awardCount))} awards</p>
    </div>
  );
}

export default function VendorStateChart({ data }) {
  if (!data?.length) return null;

  const chartData = [...data]
    .map((d) => ({
      ...d,
      totalObligated: Number(d.totalObligated),
      awardCount:     Number(d.awardCount),
    }))
    .sort((a, b) => b.totalObligated - a.totalObligated)
    .slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <XAxis dataKey="stateCode" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt.format} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="totalObligated" radius={[3, 3, 0, 0]}>
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
