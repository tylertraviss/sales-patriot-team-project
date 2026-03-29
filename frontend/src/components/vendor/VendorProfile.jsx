import { Building2, MapPin, Users, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const fmt    = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('en-US');

// Backend returns socio_economic_indicator as a descriptive string.
// Map known substrings to badge labels.
const SEI_BADGES = [
  { match: 'SMALL BUSINESS',                  label: 'Small Business',           variant: 'default' },
  { match: 'WOMEN',                           label: 'Women-Owned',              variant: 'secondary' },
  { match: 'VETERAN',                         label: 'Veteran-Owned',            variant: 'secondary' },
  { match: 'SERVICE-DISABLED',                label: 'Service-Disabled Veteran', variant: 'secondary' },
  { match: 'HUBZONE',                         label: 'HUBZone',                  variant: 'secondary' },
  { match: '8(A)',                            label: '8(a)',                     variant: 'secondary' },
  { match: 'DISADVANTAGED',                   label: 'SDB',                      variant: 'secondary' },
  { match: 'MINORITY',                        label: 'Minority-Owned',           variant: 'outline' },
  { match: 'NATIVE AMERICAN',                 label: 'Native American-Owned',    variant: 'outline' },
  { match: 'HISPANIC',                        label: 'Hispanic-Owned',           variant: 'outline' },
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

  // Support both camelCase (mock) and snake_case (backend)
  const cage          = vendor.cage_code      ?? vendor.cageCode;
  const uei           = vendor.uei;
  const city          = vendor.city;
  const stateCode     = vendor.state_code     ?? vendor.stateCode;
  const countryCode   = vendor.country_code   ?? vendor.countryCode;
  const employees     = vendor.number_of_employees ?? vendor.numberOfEmployees;
  const revenue       = vendor.annual_revenue ?? vendor.annualRevenue;
  const parent        = vendor.parent_company_name ?? vendor.parentCompanyName;
  const sei           = vendor.socio_economic_indicator ?? '';

  const location = [city, stateCode, countryCode].filter(Boolean).join(', ');

  // Derive badges from the SEI string
  const seiBadges = SEI_BADGES.filter((b) => sei.toUpperCase().includes(b.match));

  // Also check legacy camelCase boolean flags (mock data path)
  const legacyFlags = [
    { key: 'smallBusinessFlag',  label: 'Small Business',           variant: 'default' },
    { key: 'wosbFlag',           label: 'WOSB',                     variant: 'secondary' },
    { key: 'veteranOwnedFlag',   label: 'Veteran-Owned',            variant: 'secondary' },
    { key: 'sdvobFlag',          label: 'Service-Disabled Veteran', variant: 'secondary' },
    { key: 'hubzoneCertFlag',    label: 'HUBZone',                  variant: 'secondary' },
    { key: 'eightAFlag',         label: '8(a)',                     variant: 'secondary' },
    { key: 'sdbFlag',            label: 'SDB',                      variant: 'secondary' },
  ].filter((f) => vendor[f.key] === true || vendor[f.key] === 'Y');

  const allBadges = seiBadges.length > 0 ? seiBadges : legacyFlags;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Stat icon={Building2} label="UEI / CAGE" value={[uei, cage].filter(Boolean).join(' · ')} />
        {location && <Stat icon={MapPin} label="Location" value={location} />}
        {parent && <Stat icon={Building2} label="Parent Company" value={parent} />}
        {employees && <Stat icon={Users} label="Employees" value={fmtNum.format(Number(employees))} />}
        {revenue && <Stat icon={DollarSign} label="Annual Revenue" value={fmt.format(Number(revenue))} />}
      </div>

      {allBadges.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Certifications &amp; Set-Asides
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allBadges.map((b) => (
                <Badge key={b.label} variant={b.variant} className="text-xs">
                  {b.label}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
