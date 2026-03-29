import { Search, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Fiscal years available in the dropdown
const YEARS = Array.from({ length: 20 }, (_, i) => String(2024 - i)); // 2024 down to 2005

const SET_ASIDE_TYPES = [
  { value: 'SBA', label: 'Small Business' },
  { value: 'SBP', label: 'Small Business Set-Aside' },
  { value: '8A', label: '8(a)' },
  { value: 'WOSB', label: 'Women-Owned Small Business' },
  { value: 'EDWOSB', label: 'Economically Disadvantaged WOSB' },
  { value: 'HZC', label: 'HUBZone' },
  { value: 'SDVOSBC', label: 'Service-Disabled Veteran-Owned' },
  { value: 'VSB', label: 'Veteran-Owned Small Business' },
  { value: 'NONE', label: 'None / Full & Open' },
];

export default function VendorsFilters({ filters, onFilterChange, onReset }) {
  const hasActiveFilters =
    filters.search ||
    filters.year !== '2010' ||
    filters.stateCode ||
    filters.naicsCode ||
    filters.agencyCode ||
    filters.setAsideType;

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-4">
      {/* Row 1: Search + Year */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search vendor name or UEI…"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Fiscal Year */}
        <div className="w-full sm:w-44 flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground px-0.5">
            Fiscal Year
          </label>
          <Select
            value={filters.year}
            onValueChange={(val) => onFilterChange('year', val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select fiscal year">
                {filters.year ? `FY ${filters.year}` : 'Select fiscal year'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  FY {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Advanced filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="State code (e.g. CA)"
          value={filters.stateCode}
          onChange={(e) => onFilterChange('stateCode', e.target.value.toUpperCase())}
          maxLength={2}
          className="sm:w-40"
        />

        <Input
          placeholder="NAICS code"
          value={filters.naicsCode}
          onChange={(e) => onFilterChange('naicsCode', e.target.value)}
          className="sm:w-40"
        />

        <Input
          placeholder="Agency code"
          value={filters.agencyCode}
          onChange={(e) => onFilterChange('agencyCode', e.target.value)}
          className="sm:w-40"
        />

        {/* Set-aside type */}
        <div className="sm:w-56">
          <Select
            value={filters.setAsideType || '__all__'}
            onValueChange={(val) => onFilterChange('setAsideType', val === '__all__' ? '' : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Set-aside type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All set-aside types</SelectItem>
              {SET_ASIDE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset button — only visible when filters are active */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="default"
            onClick={onReset}
            className="gap-1.5 sm:ml-auto shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
