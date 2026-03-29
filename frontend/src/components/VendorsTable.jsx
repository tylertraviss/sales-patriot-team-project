import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Inbox } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Known columns with metadata. The table is built generically so unknown
// fields from the API will still render — these just provide better labels
// and formatting hints for the fields we expect.
const COLUMNS = [
  { key: 'vendorName',      label: 'Vendor Name',        sortable: true,  type: 'string',   width: 'min-w-[220px]' },
  { key: 'uei',             label: 'UEI',                sortable: true,  type: 'string',   width: 'w-[130px]' },
  { key: 'totalObligated',  label: 'Total Obligated',    sortable: true,  type: 'currency', width: 'w-[160px]', align: 'right' },
  { key: 'awardCount',      label: 'Award Count',        sortable: true,  type: 'number',   width: 'w-[120px]', align: 'right' },
  { key: 'stateCode',       label: 'State',              sortable: false, type: 'badge',    width: 'w-[80px]',  align: 'center' },
  { key: 'naicsCode',       label: 'NAICS',              sortable: false, type: 'string',   width: 'w-[100px]' },
  { key: 'agencyCode',      label: 'Agency',             sortable: false, type: 'string',   width: 'w-[100px]' },
];

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('en-US');

function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
  switch (type) {
    case 'currency': return fmt.format(Number(value));
    case 'number':   return fmtNum.format(Number(value));
    case 'badge':    return <Badge variant="secondary" className="font-mono text-xs">{value}</Badge>;
    default:         return String(value);
  }
}

function SortIcon({ column, sort }) {
  if (sort.sort !== column) return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-40 shrink-0" />;
  return sort.order === 'asc'
    ? <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" />
    : <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" />;
}

function SkeletonRows({ count, cols }) {
  return Array.from({ length: count }).map((_, i) => (
    <TableRow key={i} className="animate-pulse">
      {cols.map((col) => (
        <TableCell key={col.key} className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}>
          <div className="h-4 rounded bg-muted w-3/4 inline-block" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export default function VendorsTable({ data, loading, error, sort, onSort, onRetry, limit }) {
  // Determine visible columns: always show COLUMNS, but also render any
  // extra keys found in the first row that aren't in our known set.
  const extraKeys = data.length
    ? Object.keys(data[0]).filter((k) => !COLUMNS.find((c) => c.key === k))
    : [];

  const allColumns = [
    ...COLUMNS,
    ...extraKeys.map((k) => ({ key: k, label: k, sortable: false, type: 'string', width: '' })),
  ];

  // Detect which known columns are actually present in the data
  const presentColumns = data.length
    ? allColumns.filter((col) => col.key in data[0])
    : COLUMNS; // show all known columns as skeleton during loading

  const displayColumns = loading && data.length === 0 ? COLUMNS : presentColumns.length > 0 ? presentColumns : COLUMNS;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {displayColumns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.width,
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  'whitespace-nowrap'
                )}
              >
                {col.sortable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSort(col.key)}
                    className={cn(
                      '-ml-3 h-8 px-3 font-medium text-muted-foreground hover:text-foreground',
                      sort.sort === col.key && 'text-foreground'
                    )}
                  >
                    {col.label}
                    <SortIcon column={col.key} sort={sort} />
                  </Button>
                ) : (
                  <span className="font-medium text-muted-foreground">{col.label}</span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {/* Loading skeleton */}
          {loading && <SkeletonRows count={limit ?? 25} cols={displayColumns} />}

          {/* Error state */}
          {!loading && error && (
            <TableRow>
              <TableCell colSpan={displayColumns.length} className="h-48 text-center">
                <div className="flex flex-col items-center gap-3 text-destructive">
                  <AlertCircle className="h-8 w-8" />
                  <p className="text-sm font-medium">{error}</p>
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    Try again
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Empty state */}
          {!loading && !error && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={displayColumns.length} className="h-48 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Inbox className="h-8 w-8" />
                  <p className="text-sm">No vendors found for the selected filters.</p>
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Data rows */}
          {!loading && !error && data.map((row, idx) => (
            <TableRow key={row.uei ?? idx}>
              {displayColumns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    col.align === 'right' && 'text-right tabular-nums',
                    col.align === 'center' && 'text-center',
                    col.key === 'vendorName' && 'font-medium'
                  )}
                >
                  {formatCell(row[col.key], col.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
