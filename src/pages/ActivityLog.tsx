import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, CalendarIcon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/exportExcel';
import ExportDropdown from '@/components/ExportDropdown';
import { exportToPdf } from '@/lib/exportPdf';

const SECTIONS = ['all', 'schools', 'classes', 'students', 'attendance', 'grading', 'topics', 'holidays'] as const;

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

const ActivityLogPage = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filterSection !== 'all') query = query.eq('section', filterSection);
    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (dateFrom) query = query.gte('created_at', format(dateFrom, 'yyyy-MM-dd'));
    if (dateTo) query = query.lte('created_at', format(dateTo, 'yyyy-MM-dd') + 'T23:59:59');

    const { data } = await query;
    setLogs((data as ActivityLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filterSection, filterAction, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.description.toLowerCase().includes(q) ||
      l.user_name.toLowerCase().includes(q) ||
      l.section.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const handleExportExcel = () => {
    exportToExcel({
      filename: 'activity_log.xlsx',
      sheetName: 'Activity Log',
      rows: filtered.map(l => ({
        'Date & Time': format(new Date(l.created_at), 'dd MMM yyyy, hh:mm a'),
        'User': l.user_name,
        'Action': l.action,
        'Section': l.section,
        'Description': l.description,
      })),
    });
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: 'Activity Log',
      headers: ['Date & Time', 'User', 'Action', 'Section', 'Description'],
      rows: filtered.map(l => [
        format(new Date(l.created_at), 'dd MMM yy, hh:mm a'),
        l.user_name, l.action, l.section, l.description,
      ]),
      filename: 'activity_log.pdf',
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(d, 'dd MMM yyyy');
  };

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
          <ExportDropdown onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
          </div>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
            <SelectContent>
              {SECTIONS.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Sections' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {['created', 'updated', 'deleted', 'imported', 'duplicated', 'exported'].map(a =>
                <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
          </Popover>
        </div>

        {(dateFrom || dateTo || filterSection !== 'all' || filterAction !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setFilterSection('all'); setFilterAction('all'); setSearch(''); }}>
            Clear filters
          </Button>
        )}

        {/* Log table */}
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
                      <TableHead className="w-24">Section</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(log => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="text-sm">{formatTimeAgo(log.created_at)}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'dd MMM yyyy, hh:mm a')}</div>
                        </TableCell>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs capitalize', actionColors[log.action] || '')}>{log.action}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{log.section}</Badge>
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
