import { Building2, MapPin, Users, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('en-US');

// socioEconomicIndicator is a single code from the DB (e.g. "A", "27", "2J" etc.)
// We surface it as a plain badge rather than trying to map individual boolean flags
// that don't exist in the real backend response.
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

export default function VendorProfile({ vendor }) {
  if (!vendor) return null;

  const location = [vendor.stateCode, vendor.countryCode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="space-y-3">
        <Stat icon={Building2} label="UEI / CAGE" value={[vendor.uei, vendor.cageCode].filter(Boolean).join(' · ')} />
        {location && <Stat icon={MapPin} label="Location" value={location} />}
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
    </div>
  );
}
