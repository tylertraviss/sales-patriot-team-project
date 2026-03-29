import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt     = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fmtFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum  = new Intl.NumberFormat('en-US');

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-xs max-w-[220px]">
      <p className="font-semibold mb-1 leading-snug">{d.naicsDescription ?? d.naicsCode}</p>
      <p className="font-mono text-muted-foreground text-[10px] mb-1">{d.naicsCode}</p>
      <p className="text-primary">{fmtFull.format(Number(d.totalObligated))}</p>
      <p className="text-muted-foreground">{fmtNum.format(Number(d.awardCount))} awards</p>
    </div>
  );
}

const CustomTick = ({ x, y, payload }) => {
  const label = payload.value?.length > 26 ? payload.value.slice(0, 26) + '…' : payload.value;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#9ca3af" fontSize={10}>
      {label}
    </text>
  );
};

export default function VendorNaicsChart({ data }) {
  if (!data?.length) return null;

  const chartData = [...data]
    .map((d) => ({
      ...d,
      totalObligated: Number(d.totalObligated),
      awardCount:     Number(d.awardCount),
      label: d.naicsDescription ?? d.naicsCode,
    }))
    .sort((a, b) => b.totalObligated - a.totalObligated)
    .slice(0, 8);

  const max = chartData[0]?.totalObligated ?? 1;

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
        <XAxis type="number" tickFormatter={fmt.format} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={<CustomTick />} axisLine={false} tickLine={false} width={170} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="totalObligated" radius={[0, 3, 3, 0]}>
          {chartData.map((d, i) => (
            <Cell
              key={i}
              fill={`hsl(217, ${70 - i * 5}%, ${52 + i * 3}%)`}
              fillOpacity={1 - (d.totalObligated / max) * 0 + 0.15 * (i / chartData.length)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
