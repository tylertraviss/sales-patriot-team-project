import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmtPct = (v, total) => total ? `${((v / total) * 100).toFixed(1)}%` : '—';

const COLORS = {
  'FULL AND OPEN COMPETITION': 'hsl(142 71% 45%)',
  'FULL AND OPEN COMPETITION AFTER EXCLUSION OF SOURCES': 'hsl(142 71% 60%)',
  'NOT AVAILABLE FOR COMPETITION': 'hsl(0 84% 60%)',
  'NOT COMPETED': 'hsl(0 84% 75%)',
  'FOLLOW ON TO COMPETED ACTION': 'hsl(38 92% 50%)',
  DEFAULT: 'hsl(215 20% 65%)',
};

function color(label) {
  const upper = (label ?? '').toUpperCase();
  for (const [key, val] of Object.entries(COLORS)) {
    if (key !== 'DEFAULT' && upper.includes(key)) return val;
  }
  return COLORS.DEFAULT;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm max-w-[200px]">
      <p className="font-medium mb-0.5 leading-snug">{d.name}</p>
      <p style={{ color: payload[0].fill }} className="font-semibold">
        {fmtPct(d.value, d.total)} ({d.value} awards)
      </p>
    </div>
  );
}

export default function VendorCompetitionChart({ data }) {
  if (!data?.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">No competition data available.</p>
  );

  const chartData = data.map((d) => ({
    name: d.extentCompeted ?? d.extent_competed ?? d.label ?? 'Unknown',
    value: Number(d.count ?? d.awardCount ?? d.award_count ?? 0),
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const enriched = chartData.map((d) => ({ ...d, total }));

  // Competed vs not-competed summary stat
  const competed = chartData
    .filter((d) => d.name.toUpperCase().includes('FULL AND OPEN') || d.name.toUpperCase().includes('COMPETED'))
    .reduce((s, d) => s + d.value, 0);
  const competedPct = total ? Math.round((competed / total) * 100) : null;

  return (
    <div className="space-y-2">
      {competedPct !== null && (
        <div className="flex items-center gap-3 px-1">
          <div className="text-2xl font-bold text-foreground">{competedPct}%</div>
          <p className="text-sm text-muted-foreground leading-tight">
            of contracts were<br />competed
          </p>
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={enriched}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {enriched.map((entry, i) => (
              <Cell key={i} fill={color(entry.name)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-foreground">{
                value.length > 32 ? value.slice(0, 32) + '…' : value
              }</span>
            )}
            iconSize={10}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
