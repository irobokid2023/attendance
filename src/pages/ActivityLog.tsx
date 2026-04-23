import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SECTIONS = ['all', 'schools', 'classes', 'students', 'attendance', 'grading', 'topics', 'holidays', 'payments', 'misc_tasks', 'profile'] as const;

const SECTION_LABELS: Record<(typeof SECTIONS)[number], string> = {
  all: 'All Sections',
  schools: 'Schools',
  classes: 'Classes',
  students: 'Students',
  attendance: 'Attendance',
  grading: 'Grading',
  topics: 'Topics',
  holidays: 'Holidays',
  payments: 'Payments',
  misc_tasks: 'Miscellaneous Tasks',
  profile: 'Profile',
};

const RANGE_OPTIONS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
] as const;

const ACTIONS = ['created', 'updated', 'deleted', 'imported', 'duplicated', 'exported'] as const;
const PAGE_SIZE = 1000;

const actionColors: Record<string, string> = {
  created: 'bg-success/10 text-success border-success/20',
  updated: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  deleted: 'bg-destructive/10 text-destructive border-destructive/20',
  imported: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  duplicated: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  exported: 'bg-muted text-muted-foreground border-border',
};

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  section: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

const getFromDate = (rangeDays: string) => {
  const days = parseInt(rangeDays, 10);
  const date = new Date();

  if (days === 1) {
    date.setHours(date.getHours() - 24);
  } else {
    date.setDate(date.getDate() - days);
  }

  return date;
};

const ActivityLogPage = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');
  const [rangeDays, setRangeDays] = useState<string>('1');

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    const fromDate = getFromDate(rangeDays);
    const allLogs: ActivityLog[] = [];
    let offset = 0;

    while (true) {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .gte('created_at', fromDate.toISOString())
        .range(offset, offset + PAGE_SIZE - 1);

      if (filterSection !== 'all') query = query.eq('section', filterSection);
      if (filterAction !== 'all') query = query.eq('action', filterAction);

      const { data, error } = await query;

      if (error) break;

      const batch = (data as ActivityLog[]) ?? [];
      allLogs.push(...batch);

      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    setLogs(allLogs);
    setLoading(false);
  }, [filterAction, filterSection, rangeDays]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const refreshLogs = () => void fetchLogs();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshLogs();
    };

    const intervalId = window.setInterval(refreshLogs, 30000);
    window.addEventListener('focus', refreshLogs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshLogs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchLogs]);

  const filtered = useMemo(() => {
    if (!search) return logs;

    const q = search.toLowerCase();
    return logs.filter((log) =>
      log.description.toLowerCase().includes(q) ||
      log.user_name.toLowerCase().includes(q) ||
      log.section.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return format(date, 'dd MMM yyyy');
  };

  const hasActiveFilters = rangeDays !== '1' || filterSection !== 'all' || filterAction !== 'all' || search;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="w-6 h-6 text-primary" /> Activity Log
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Track all actions performed across the platform</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
          </div>
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger>
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((section) => (
                <SelectItem key={section} value={section}>
                  {SECTION_LABELS[section]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger>
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setRangeDays('1'); setFilterSection('all'); setFilterAction('all'); setSearch(''); }}>
            Reset filters
          </Button>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-20 text-muted-foreground">Loading activity logs...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No activity logs found.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">When</TableHead>
                      <TableHead className="w-40">User</TableHead>
                      <TableHead className="w-24">Action</TableHead>
                      <TableHead className="w-32">Section</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="text-sm">{formatTimeAgo(log.created_at)}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')}</div>
                        </TableCell>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs capitalize', actionColors[log.action] || '')}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {SECTION_LABELS[log.section as keyof typeof SECTION_LABELS] || log.section.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">{log.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ActivityLogPage;