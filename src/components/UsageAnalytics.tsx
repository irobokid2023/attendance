import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, ExternalLink, Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type Range = '7' | '30' | '90';

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

  const days = parseInt(range, 10);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const buckets = buildDayBuckets(days);
      const since = buckets[0] + 'T00:00:00.000Z';

      // Pull date columns only (lightweight) for each source
      const sourceResults = await Promise.all(
        SOURCES.map(async (s) => {
          const { data, error } = await supabase
            .from(s.table as any)
            .select(s.dateColumn)
            .gte(s.dateColumn, since)
            .limit(10000);
          if (error) return { key: s.key, dates: [] as string[] };
          const dates = (data ?? [])
            .map((r: any) => (r[s.dateColumn] as string)?.slice(0, 10))
            .filter(Boolean);
          return { key: s.key, dates };
        })
      );

      // Bucket per day
      const dayMap: Record<string, Record<string, number>> = {};
      buckets.forEach((d) => {
        dayMap[d] = { day: 0 as any };
      });
      const totalsAcc: Record<string, number> = {};
      sourceResults.forEach(({ key, dates }) => {
        totalsAcc[key] = dates.length;
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

      // Row counts (HEAD requests = cheap)
      const rowCountResults = await Promise.all(
        ROW_COUNT_TABLES.map(async (t) => {
          const { count } = await supabase
            .from(t as any)
            .select('*', { count: 'exact', head: true });
          return [t, count ?? 0] as const;
        })
      );

      if (cancelled) return;
      setSeries(built);
      setTotals(totalsAcc);
      setRowCounts(Object.fromEntries(rowCountResults));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [days]);

  const totalRows = useMemo(
    () => Object.values(rowCounts).reduce((a, b) => a + b, 0),
    [rowCounts]
  );

  const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
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
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Totals strip */}
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

          {/* Chart */}
          <div className="h-72 w-full">
            {loading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(series.length / 10))} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
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
  );
};

export default UsageAnalytics;
