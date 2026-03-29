import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getVendorAwards } from '@/services/vendors';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function competitionVariant(val) {
  if (!val) return 'outline';
  const v = val.toUpperCase();
  if (v.includes('FULL AND OPEN')) return 'default';
  if (v.includes('NOT COMPETED') || v.includes('NOT AVAILABLE')) return 'destructive';
  return 'secondary';
}

const cols = [
  { key: 'piid',              label: 'Contract ID',  width: 'w-[140px]' },
  { key: 'dollarsObligated',  label: 'Obligated',    width: 'w-[120px]', align: 'right' },
  { key: 'dateSigned',        label: 'Date Signed',  width: 'w-[110px]' },
  { key: 'awardType',         label: 'Type',         width: 'w-[120px]' },
  { key: 'agencyCode',        label: 'Agency',       width: 'w-[90px]' },
  { key: 'extentCompetedName',label: 'Competition',  width: '' },
  { key: 'setAsideName',      label: 'Set-Aside',    width: 'w-[100px]' },
];

function cellValue(row, key) {
  const v = row[key];
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
  if (key === 'dollarsObligated') return <span className="tabular-nums">{fmt.format(Number(v))}</span>;
  if (key === 'dateSigned') return String(v).slice(0, 10);
  if (key === 'extentCompetedName') {
    const label = String(v)
      .replace('FULL AND OPEN COMPETITION AFTER EXCLUSION OF SOURCES', 'Full & Open (Excl.)')
      .replace('FULL AND OPEN COMPETITION', 'Full & Open')
      .replace('NOT AVAILABLE FOR COMPETITION', 'Not Competed');
    return <Badge variant={competitionVariant(String(v))} className="text-xs whitespace-nowrap">{label}</Badge>;
  }
  if (key === 'setAsideName' && v !== 'NONE' && v !== 'N/A') {
    return <Badge variant="secondary" className="text-xs">{v}</Badge>;
  }
  return <span className="truncate max-w-[160px] block" title={String(v)}>{String(v)}</span>;
}

export default function VendorAwardsTable({ cageCode }) {
  const [awards, setAwards] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAwards = useCallback(async () => {
    if (!cageCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getVendorAwards(cageCode, {
        page,
        limit,
        sort: 'award_amount',
        order: 'desc',
      });
      setAwards(res.data ?? []);
      setMeta(res.pagination ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cageCode, page, limit]);

  useEffect(() => { fetchAwards(); }, [fetchAwards]);

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {cols.map((c) => (
                <TableHead key={c.key} className={cn(c.width, c.align === 'right' && 'text-right', 'text-xs whitespace-nowrap')}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: limit }).map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                {cols.map((c) => (
                  <TableCell key={c.key}>
                    <div className="h-3 rounded bg-muted w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={cols.length} className="text-center text-sm text-destructive py-6">
                  {error}
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && awards.length === 0 && (
              <TableRow>
                <TableCell colSpan={cols.length} className="text-center text-sm text-muted-foreground py-6">
                  No awards found.
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && awards.map((row, i) => (
              <TableRow key={row.piid ?? i}>
                {cols.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === 'right' && 'text-right', 'text-xs py-2')}>
                    {cellValue(row, c.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mini pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages} · {meta.total.toLocaleString()} awards
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.totalPages}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
