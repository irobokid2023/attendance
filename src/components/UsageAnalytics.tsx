import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, Database, ExternalLink, HardDrive, HelpCircle, Info, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Legend } from 'recharts';

type Range = '1' | '7' | '15' | '30';

const SOURCES: { key: string; label: string; table: string; dateColumn: string }[] = [
  { key: 'students', label: 'New Students', table: 'students', dateColumn: 'created_at' },
  { key: 'attendance', label: 'Attendance Marks', table: 'attendance', dateColumn: 'created_at' },
  { key: 'topics', label: 'Topics Logged', table: 'topics', dateColumn: 'created_at' },
  { key: 'payments', label: 'Payments Recorded', table: 'payments', dateColumn: 'created_at' },
  { key: 'activity', label: 'Activity Log Entries', table: 'activity_logs', dateColumn: 'created_at' },
];

const ROW_COUNT_TABLES = [
  'schools', 'classes', 'students', 'attendance', 'topics', 'grading',
  'payments', 'misc_tasks', 'holidays', 'activity_logs', 'profiles', 'user_roles',
] as const;

const formatDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

interface TableSize {
  table_name: string;
  total_bytes: number;
  table_bytes: number;
  index_bytes: number;
  row_estimate: number;
}

const buildDayBuckets = (days: number): string[] => {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const UsageAnalytics = () => {
  const [range, setRange] = useState<Range>('30');
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Record<string, number>[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [tableSizes, setTableSizes] = useState<TableSize[]>([]);
  const [driveStorage, setDriveStorage] = useState<{ total_bytes: number; file_count: number; folder_count: number; exists: boolean } | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);


  const days = parseInt(range, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const buckets = buildDayBuckets(days);
    const since = buckets[0] + 'T00:00:00.000Z';

    // Fetch ALL dates in window using pagination so totals are exact (not capped).
    const PAGE = 1000;
    const sourceResults = await Promise.all(
      SOURCES.map(async (s) => {
        const dates: string[] = [];
        let from = 0;
        // Loop until we've drained the table for this window.
        // Safety cap at 200k rows to avoid runaway requests.
        while (from < 200000) {
          const { data, error } = await supabase
            .from(s.table as any)
            .select(s.dateColumn)
            .gte(s.dateColumn, since)
            .order(s.dateColumn, { ascending: false })
            .range(from, from + PAGE - 1);
          if (error || !data || data.length === 0) break;
          dates.push(
            ...data.map((r: any) => (r[s.dateColumn] as string)?.slice(0, 10)).filter(Boolean)
          );
          if (data.length < PAGE) break;
          from += PAGE;
        }
        // Cross-check totals against an exact head-count for accuracy.
        const { count } = await supabase
          .from(s.table as any)
          .select('*', { count: 'exact', head: true })
          .gte(s.dateColumn, since);
        return { key: s.key, dates, total: count ?? dates.length };
      })
    );

    const dayMap: Record<string, Record<string, number>> = {};
    buckets.forEach((d) => {
      dayMap[d] = { day: 0 as any };
    });
    const totalsAcc: Record<string, number> = {};
    sourceResults.forEach(({ key, dates, total }) => {
      totalsAcc[key] = total;
      dates.forEach((d) => {
        if (!dayMap[d]) return;
        dayMap[d][key] = (dayMap[d][key] || 0) + 1;
      });
    });
    const built = buckets.map((d) => {
      const row: Record<string, any> = { day: formatDay(d), date: d };
      SOURCES.forEach((s) => { row[s.key] = dayMap[d][s.key] || 0; });
      return row;
    });

    const rowCountResults = await Promise.all(
      ROW_COUNT_TABLES.map(async (t) => {
        const { count } = await supabase
          .from(t as any)
          .select('*', { count: 'exact', head: true });
        return [t, count ?? 0] as const;
      })
    );

    const { data: sizeRows } = await supabase.rpc('get_table_sizes' as any);

    // Fetch Google Drive media storage usage
    setDriveError(null);
    try {
      const { data: driveData, error: driveErr } = await supabase.functions.invoke('drive-storage', { body: {} });
      if (driveErr) throw driveErr;
      if (driveData?.ok) {
        setDriveStorage({
          total_bytes: Number(driveData.total_bytes || 0),
          file_count: Number(driveData.file_count || 0),
          folder_count: Number(driveData.folder_count || 0),
          exists: !!driveData.exists,
        });
      } else if (driveData?.error) {
        setDriveError(String(driveData.error));
        setDriveStorage(null);
      }
    } catch (e: any) {
      setDriveError(String(e?.message ?? e));
      setDriveStorage(null);
    }

    setSeries(built);
    setTotals(totalsAcc);
    setRowCounts(Object.fromEntries(rowCountResults));
    setTableSizes((sizeRows as TableSize[]) ?? []);
    setLoading(false);
  }, [days]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
    })();
    return () => { cancelled = true; };
  }, [load, refreshTick]);

  const totalRows = useMemo(
    () => Object.values(rowCounts).reduce((a, b) => a + b, 0),
    [rowCounts]
  );

  const totalStorageBytes = useMemo(
    () => tableSizes.reduce((sum, t) => sum + Number(t.total_bytes || 0), 0),
    [tableSizes]
  );

  const totalDataBytes = useMemo(
    () => tableSizes.reduce((sum, t) => sum + Number(t.table_bytes || 0), 0),
    [tableSizes]
  );

  const totalIndexBytes = useMemo(
    () => tableSizes.reduce((sum, t) => sum + Number(t.index_bytes || 0), 0),
    [tableSizes]
  );

  const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">App Activity</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Daily</Badge>
            </div>
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 day</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="15">Last 15 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {SOURCES.map((s, i) => (
                <div key={s.key} className="rounded-lg border bg-card/50 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  {loading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <div className="text-2xl font-bold font-heading mt-0.5" style={{ color: colors[i] }}>
                      {totals[s.key] ?? 0}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">in last {days}d</div>
                </div>
              ))}
            </div>

            <div className="h-72 w-full">
              {loading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(series.length / 10))} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {SOURCES.map((s, i) => (
                      <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={colors[i]}
                        fill={colors[i]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4 text-primary" /> Database Footprint
              <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wider">
                {totalRows.toLocaleString()} rows
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {ROW_COUNT_TABLES.map((t) => (
                <div key={t} className="rounded-lg border bg-card/50 p-3 flex items-center justify-between">
                  <span className="text-xs font-medium capitalize">{t.replace(/_/g, ' ')}</span>
                  {loading ? (
                    <Skeleton className="h-5 w-10" />
                  ) : (
                    <span className="text-sm font-bold tabular-nums">{(rowCounts[t] ?? 0).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="w-4 h-4 text-primary" /> Database Size Summary
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRefreshTick((n) => n + 1)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border bg-card/50 p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Total Size
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Exact measurement from PostgreSQL system catalogs (pg_total_relation_size). Includes table data, indexes, and TOAST storage.
                    </TooltipContent>
                  </Tooltip>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <div className="text-2xl font-bold tabular-nums">{formatBytes(totalStorageBytes)}</div>
                )}
              </div>

              <div className="rounded-lg border bg-card/50 p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Data Size
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Exact size of table data only (pg_table_size), excluding indexes.
                    </TooltipContent>
                  </Tooltip>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <div className="text-2xl font-bold tabular-nums">{formatBytes(totalDataBytes)}</div>
                )}
              </div>

              <div className="rounded-lg border bg-card/50 p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Index Size
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Exact size of all indexes on the tables (pg_indexes_size).
                    </TooltipContent>
                  </Tooltip>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <div className="text-2xl font-bold tabular-nums">{formatBytes(totalIndexBytes)}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="w-4 h-4 text-primary" /> Storage per Table
              <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wider">
                DB {formatBytes(totalStorageBytes)}
                {driveStorage && ` + Drive ${formatBytes(driveStorage.total_bytes)}`}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Database tables plus a dedicated entry for media uploaded to Google Drive (folder: <span className="font-medium">iRobokid Media</span>).
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Google Drive media entry */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-primary" />
                      Upload Media (Google Drive)
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-bold tabular-nums text-primary cursor-help underline decoration-dotted">
                          {driveError ? '—' : formatBytes(driveStorage?.total_bytes ?? 0)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {driveError
                          ? `Could not fetch Drive usage: ${driveError}`
                          : `Exact total size of all files under the "iRobokid Media" Drive folder, summed across schools and classes.`}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{driveStorage ? `${driveStorage.file_count.toLocaleString()} files` : driveError ? 'Unavailable' : '—'}</span>
                    <span>{driveStorage ? `${driveStorage.folder_count.toLocaleString()} folders` : ''}</span>
                  </div>
                </div>

                {tableSizes.map((t) => {
                  const pct = totalStorageBytes ? (Number(t.total_bytes) / totalStorageBytes) * 100 : 0;
                  const dataOnly = Number(t.table_bytes) - Number(t.index_bytes);
                  return (
                    <div key={t.table_name} className="rounded-lg border bg-card/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize truncate">{t.table_name.replace(/_/g, ' ')}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-bold tabular-nums text-primary cursor-help underline decoration-dotted">
                              {formatBytes(Number(t.total_bytes))}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Total: {formatBytes(Number(t.total_bytes))} (exact). Row estimate: {Number(t.row_estimate).toLocaleString()} — this is a live planner estimate, not an exact count.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Data: {formatBytes(dataOnly > 0 ? dataOnly : Number(t.table_bytes))}</span>
                        <span>Indexes: {formatBytes(Number(t.index_bytes))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>


        <Card className="border-dashed">
          <CardContent className="pt-6 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold">Backend Platform Metrics</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Low-level metrics like API requests, auth events, edge function invocations, database egress
                and storage size are tracked by the backend platform itself and aren't exposed to the app.
                View them anytime in the backend dashboard.
              </p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                Open backend dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default UsageAnalytics;
