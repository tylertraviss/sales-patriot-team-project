import { Building2, MapPin, Users, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('en-US');

const DIVERSITY_FLAGS = [
  { key: 'smallBusinessFlag',         label: 'Small Business',           variant: 'default' },
  { key: 'wosbFlag',                  label: 'WOSB',                     variant: 'secondary' },
  { key: 'edwosbFlag',                label: 'EDWOSB',                   variant: 'secondary' },
  { key: 'veteranOwnedFlag',          label: 'Veteran-Owned',            variant: 'secondary' },
  { key: 'sdvobFlag',                 label: 'Service-Disabled Veteran', variant: 'secondary' },
  { key: 'hubzoneCertFlag',           label: 'HUBZone',                  variant: 'secondary' },
  { key: 'eightAFlag',                label: '8(a)',                     variant: 'secondary' },
  { key: 'sdbFlag',                   label: 'SDB',                      variant: 'secondary' },
  { key: 'minorityOwnedFlag',         label: 'Minority-Owned',           variant: 'outline' },
  { key: 'hispanicOwnedFlag',         label: 'Hispanic-Owned',           variant: 'outline' },
  { key: 'nativeAmericanOwnedFlag',   label: 'Native American-Owned',    variant: 'outline' },
  { key: 'emergingSmallBusinessFlag', label: 'Emerging Small Business',  variant: 'outline' },
];

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

  const location = [vendor.city, vendor.stateCode, vendor.countryName]
    .filter(Boolean)
    .join(', ');

  const activeDiversity = DIVERSITY_FLAGS.filter(
    (f) => vendor[f.key] === true || vendor[f.key] === 'Y' || vendor[f.key] === 'YES'
  );

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="space-y-3">
        <Stat icon={Building2} label="UEI / CAGE" value={[vendor.uei, vendor.cageCode].filter(Boolean).join(' · ')} />
        {location && <Stat icon={MapPin} label="Location" value={location} />}
        {vendor.parentCompanyName && (
          <Stat icon={Building2} label="Parent Company" value={vendor.parentCompanyName} />
        )}
        {vendor.numberOfEmployees && (
          <Stat icon={Users} label="Employees" value={fmtNum.format(vendor.numberOfEmployees)} />
        )}
        {vendor.annualRevenue && (
          <Stat icon={DollarSign} label="Annual Revenue" value={fmt.format(vendor.annualRevenue)} />
        )}
      </div>

      {/* Diversity / certifications */}
      {activeDiversity.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Certifications & Set-Asides
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeDiversity.map((f) => (
                <Badge key={f.key} variant={f.variant} className="text-xs">
                  {f.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
