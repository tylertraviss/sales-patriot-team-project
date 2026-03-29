import { Building2, MapPin, Users, DollarSign, Trophy, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('en-US');

function Stat({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// ── Win-rate donut ────────────────────────────────────────────────────────────
function WinRateDonut({ pct }) {
  const data = [
    { name: 'Won',  value: pct },
    { name: 'Lost', value: 100 - pct },
  ];
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={26} outerRadius={36} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
              <Cell fill="#3b82f6" />
              <Cell fill="#e2e8f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Competitive win rate on awarded contracts
      </div>
    </div>
  );
}

// ── Competed vs Sole Source bar ───────────────────────────────────────────────
function CompetitionBar({ competed, soleSource }) {
  const total = competed + soleSource;
  if (!total) return null;
  const competedPct = (competed / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Competed ({fmtNum.format(competed)})</span>
        <span>Sole Source ({fmtNum.format(soleSource)})</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${competedPct}%` }} />
        <div className="h-full bg-amber-400 flex-1" />
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />Competed</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />Sole Source</span>
      </div>
    </div>
  );
}

// ── Set-aside history timeline ────────────────────────────────────────────────
function SetAsideTimeline({ history, graduated }) {
  if (!history?.length) return null;
  // Deduplicate and take meaningful entries (non-NONE or the latest NONE per year)
  const relevant = history
    .filter((h) => h.type !== 'NONE')
    .reduce((acc, h) => {
      const key = `${h.fiscalYear}_${h.type}`;
      if (!acc.find((e) => `${e.fiscalYear}_${e.type}` === key)) acc.push(h);
      return acc;
    }, [])
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (!relevant.length) return null;

  const TYPE_COLORS = {
    SBA: 'bg-blue-100 text-blue-700 border-blue-200',
    RSB: 'bg-violet-100 text-violet-700 border-violet-200',
    SBP: 'bg-sky-100 text-sky-700 border-sky-200',
    '8A': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Set-Aside History</p>
        {graduated && (
          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            Graduated
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {relevant.slice(0, 12).map((h, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${TYPE_COLORS[h.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
          >
            <span>{h.fiscalYear}</span>
            <span className="font-mono">{h.type}</span>
          </span>
        ))}
        {relevant.length > 12 && (
          <span className="text-[10px] text-muted-foreground self-center">+{relevant.length - 12} more</span>
        )}
      </div>
    </div>
  );
}

export default function VendorProfile({ vendor, winRate }) {
  if (!vendor) return null;

  const location = [vendor.city, vendor.stateCode, vendor.countryCode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="space-y-3">
        <Stat icon={Building2} label="UEI / CAGE" value={[vendor.uei, vendor.cageCode].filter(Boolean).join(' · ')} />
        {location && <Stat icon={MapPin} label="Location" value={location} />}
        {vendor.congressionalDistrict && (
          <Stat icon={MapPin} label="Congressional District" value={vendor.congressionalDistrict} />
        )}
        {vendor.numberOfEmployees && (
          <Stat icon={Users} label="Employees" value={fmtNum.format(vendor.numberOfEmployees)} />
        )}
        {vendor.annualRevenue && (
          <Stat icon={DollarSign} label="Annual Revenue" value={fmt.format(vendor.annualRevenue)} />
        )}
      </div>

      {/* Socio-economic indicator badge */}
      {vendor.socioEconomicIndicator && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Socio-Economic Indicator
            </p>
            <Badge variant="secondary" className="text-xs font-mono">
              {vendor.socioEconomicIndicator}
            </Badge>
          </div>
        </>
      )}

      {/* Win Rate section */}
      {winRate && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Win Rate</p>
            </div>

            {winRate.competitiveWinRatePct != null && (
              <WinRateDonut pct={winRate.competitiveWinRatePct} />
            )}

            {(winRate.competedAwards != null && winRate.soleSourceAwards != null) && (
              <CompetitionBar
                competed={winRate.competedAwards}
                soleSource={winRate.soleSourceAwards}
              />
            )}

            {winRate.avgOffersReceived != null && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Avg offers received:</span>
                <span className="font-semibold">{Number(winRate.avgOffersReceived).toFixed(1)}</span>
              </div>
            )}

            <SetAsideTimeline
              history={winRate.setasideHistory}
              graduated={winRate.graduatedFromSetaside}
            />
          </div>
        </>
      )}
    </div>
  );
}
