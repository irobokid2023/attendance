import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut, MapPin, Users2, Loader2, Download, RefreshCw, AlertTriangle, CalendarRange } from 'lucide-react';
import { format, parseISO, differenceInMinutes, subDays, eachDayOfInterval, isWeekend } from 'date-fns';

const DEFAULT_EXPECTED_HOURS = 8.5;
const DEFAULT_START_TIME = '09:15';
const SETTINGS_KEY = 'instructor_attendance_settings';

const getGeolocation = (): Promise<{ lat: number; lng: number } | null> =>
  new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
    const j = await r.json();
    return j?.display_name ?? null;
  } catch { return null; }
};

const minutesToHm = (mins: number) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;

const InstructorAttendance = () => {
  const { user, role } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  // Filters
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [instructorFilter, setInstructorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Configurable parameters
  const stored = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } })();
  const [expectedHours, setExpectedHours] = useState<number>(stored.expectedHours ?? DEFAULT_EXPECTED_HOURS);
  const [startTime, setStartTime] = useState<string>(stored.startTime ?? DEFAULT_START_TIME);
  const [countSundays, setCountSundays] = useState<boolean>(stored.countSundays ?? false);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ expectedHours, startTime, countSundays }));
  }, [expectedHours, startTime, countSundays]);

  const expectedMinutes = Math.round(expectedHours * 60);
  const fromDate = useMemo(() => subDays(new Date(), rangeDays - 1), [rangeDays]);
  const fromStr = format(fromDate, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const loadRecords = async () => {
    if (!user) return;
    setLoading(true);
    const [attRes, profRes] = await Promise.all([
      (supabase as any)
        .from('instructor_attendance')
        .select('*')
        .gte('date', fromStr)
        .order('date', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, email'),
    ]);
    if (attRes.error) { toast.error(attRes.error.message); setLoading(false); return; }
    const nameMap = new Map<string, string>();
    (profRes.data ?? []).forEach((p: any) => nameMap.set(p.user_id, (p.full_name || '').trim() || p.email || '—'));
    setProfiles(profRes.data ?? []);
    setRecords(((attRes.data as any[]) ?? []).map(r => ({ ...r, instructor_name: nameMap.get(r.instructor_id) ?? '—' })));
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, [user, rangeDays]);

  const todayRecord = useMemo(
    () => records.find(r => r.instructor_id === user?.id && r.date === todayStr),
    [records, user, todayStr]
  );

  const workedMinutes = (r: any) =>
    r.check_in_at && r.check_out_at ? differenceInMinutes(parseISO(r.check_out_at), parseISO(r.check_in_at)) : 0;
  const hoursDisplay = (r: any) => (r.check_in_at && r.check_out_at ? minutesToHm(workedMinutes(r)) : '—');
  const isFullDay = (r: any) => workedMinutes(r) >= expectedMinutes;
  const isLate = (r: any) => {
    if (!r.check_in_at) return false;
    const [h, m] = startTime.split(':').map(Number);
    const inAt = parseISO(r.check_in_at);
    return inAt.getHours() * 60 + inAt.getMinutes() > h * 60 + m;
  };
  const statusOf = (r: any) => {
    if (!r?.check_in_at) return 'pending';
    if (!r.check_out_at) return 'in_progress';
    return isFullDay(r) ? 'full' : 'short';
  };
  const statusBadge = (r: any) => {
    const s = statusOf(r);
    if (s === 'pending') return <Badge variant="outline">Pending</Badge>;
    if (s === 'in_progress') return <Badge variant="secondary">In Progress</Badge>;
    if (s === 'full') return <Badge>Full Day</Badge>;
    return <Badge variant="destructive">Short</Badge>;
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setWorking(true);
    const geo = await getGeolocation();
    if (!geo) { toast.error('GPS location required. Please enable location services and try again.'); setWorking(false); return; }
    const address = await reverseGeocode(geo.lat, geo.lng);
    const payload: any = {
      instructor_id: user.id,
      date: todayStr,
      location: address || `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`,
      check_in_at: new Date().toISOString(),
      check_in_lat: geo.lat,
      check_in_lng: geo.lng,
      created_by: user.id,
    };
    const { error } = await (supabase as any)
      .from('instructor_attendance')
      .upsert(payload, { onConflict: 'instructor_id,date' });
    if (error) toast.error(error.message);
    else {
      toast.success('Checked in successfully');
      logActivity({ action: 'created', section: 'instructor_attendance', description: `Checked in on ${todayStr}` });
      loadRecords();
    }
    setWorking(false);
  };

  const handleCheckOut = async () => {
    if (!todayRecord) { toast.error('Check in first'); return; }
    setWorking(true);
    const geo = await getGeolocation();
    if (!geo) { toast.error('GPS location required. Please enable location services and try again.'); setWorking(false); return; }
    const { error } = await (supabase as any)
      .from('instructor_attendance')
      .update({ check_out_at: new Date().toISOString(), check_out_lat: geo.lat, check_out_lng: geo.lng })
      .eq('id', todayRecord.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Checked out successfully');
      logActivity({ action: 'updated', section: 'instructor_attendance', description: `Checked out on ${todayStr}` });
      loadRecords();
    }
    setWorking(false);
  };

  /* ---------------- derived data ---------------- */

  const days = useMemo(
    () => eachDayOfInterval({ start: fromDate, end: new Date() }).map(d => format(d, 'yyyy-MM-dd')),
    [fromDate]
  );

  const workingDays = useMemo(
    () => days.filter(d => countSundays || !(new Date(d + 'T00:00:00').getDay() === 0)),
    [days, countSundays]
  );

  const instructorList = useMemo(() => {
    const seen = new Map<string, string>();
    profiles.forEach((p: any) => seen.set(p.user_id, (p.full_name || '').trim() || p.email || '—'));
    records.forEach(r => { if (!seen.has(r.instructor_id)) seen.set(r.instructor_id, r.instructor_name); });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (instructorFilter !== 'all' && r.instructor_id !== instructorFilter) return false;
      if (statusFilter !== 'all' && statusOf(r) !== statusFilter) return false;
      if (search) {
        const hay = `${r.instructor_name} ${r.location ?? ''} ${r.date}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, instructorFilter, statusFilter, search, expectedMinutes]);

  const perInstructor = useMemo(() => {
    const visible = instructorList.filter(i => instructorFilter === 'all' || i.id === instructorFilter);
    return visible.map(i => {
      const rows = records.filter(r => r.instructor_id === i.id);
      const present = rows.filter(r => r.check_in_at).length;
      const totalMins = rows.reduce((sum, r) => sum + workedMinutes(r), 0);
      const complete = rows.filter(r => r.check_in_at && r.check_out_at);
      const full = complete.filter(isFullDay).length;
      const short = complete.length - full;
      const late = rows.filter(isLate).length;
      const missing = rows.filter(r => r.check_in_at && !r.check_out_at && r.date !== todayStr).length;
      const last = rows.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return {
        ...i,
        present,
        absent: Math.max(0, workingDays.length - present),
        totalMins,
        avgMins: complete.length ? totalMins / complete.length : 0,
        full, short, late, missing,
        rate: workingDays.length ? Math.round((present / workingDays.length) * 100) : 0,
        lastLocation: last?.location ?? '—',
        lastSeen: last?.date ?? '—',
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [instructorList, records, workingDays, instructorFilter, expectedMinutes, startTime, todayStr]);

  const kpis = useMemo(() => {
    const complete = records.filter(r => r.check_in_at && r.check_out_at);
    const totalMins = complete.reduce((s, r) => s + workedMinutes(r), 0);
    const presentToday = records.filter(r => r.date === todayStr && r.check_in_at).length;
    return {
      instructors: instructorList.length,
      presentToday,
      absentToday: Math.max(0, instructorList.length - presentToday),
      totalHours: minutesToHm(totalMins),
      avgHours: complete.length ? minutesToHm(totalMins / complete.length) : '—',
      fullDays: complete.filter(isFullDay).length,
      shortDays: complete.filter(r => !isFullDay(r)).length,
      lateCheckIns: records.filter(isLate).length,
      missingCheckouts: records.filter(r => r.check_in_at && !r.check_out_at && r.date !== todayStr).length,
      overallRate: instructorList.length && workingDays.length
        ? Math.round((records.filter(r => r.check_in_at).length / (instructorList.length * workingDays.length)) * 100)
        : 0,
    };
  }, [records, instructorList, workingDays, expectedMinutes, startTime, todayStr]);

  const cellFor = (instructorId: string, day: string) => records.find(r => r.instructor_id === instructorId && r.date === day);

  const exportCsv = () => {
    const head = ['Date', 'Instructor', 'Check In', 'Check Out', 'Hours', 'Late', 'Status', 'Location', 'Check-in GPS', 'Check-out GPS'];
    const lines = filteredRecords.map(r => [
      r.date,
      r.instructor_name,
      r.check_in_at ? format(parseISO(r.check_in_at), 'p') : '',
      r.check_out_at ? format(parseISO(r.check_out_at), 'p') : '',
      hoursDisplay(r),
      isLate(r) ? 'Yes' : 'No',
      statusOf(r),
      (r.location ?? '').replace(/,/g, ' '),
      r.check_in_lat != null ? `${r.check_in_lat},${r.check_in_lng}` : '',
      r.check_out_lat != null ? `${r.check_out_lat},${r.check_out_lng}` : '',
    ]);
    const csv = [head, ...lines].map(row => row.map(c => `"${String(c ?? '')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `Instructor_Attendance_last_${rangeDays}_days.csv`;
    a.click();
    toast.success('Exported CSV');
  };

  const kpiCards = [
    { label: 'Instructors', value: kpis.instructors },
    { label: 'Present Today', value: kpis.presentToday },
    { label: 'Absent Today', value: kpis.absentToday },
    { label: `Attendance % (${rangeDays}d)`, value: `${kpis.overallRate}%` },
    { label: 'Total Hours', value: kpis.totalHours },
    { label: 'Avg Hours / Day', value: kpis.avgHours },
    { label: 'Full Days', value: kpis.fullDays },
    { label: 'Short Days', value: kpis.shortDays },
    { label: 'Late Check-ins', value: kpis.lateCheckIns },
    { label: 'Missing Check-outs', value: kpis.missingCheckouts },
  ];

  return (
    <DashboardLayout>
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><Users2 className="w-6 h-6" /> Instructor Attendance</h1>
          <p className="page-subtitle">Admin view — GPS check-in / check-out, hours, punctuality and a rolling {rangeDays}-day history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadRecords} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
        </div>
      </div>

      {/* Today card */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">My Attendance — {format(new Date(), 'EEEE, dd MMM yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayRecord && (
            <div className="p-3 rounded-lg bg-muted/40 mb-4 text-sm space-y-1.5">
              <div className="flex items-center gap-2"><LogIn className="w-3.5 h-3.5" /> <span className="font-medium">Checked in:</span> {todayRecord.check_in_at ? format(parseISO(todayRecord.check_in_at), 'p') : '—'}
                {isLate(todayRecord) && <Badge variant="destructive" className="ml-2 text-[10px]">Late</Badge>}
                {todayRecord.check_in_lat != null && <Badge variant="outline" className="ml-2 text-[10px]"><MapPin className="w-3 h-3 mr-1" />{todayRecord.check_in_lat.toFixed(4)}, {todayRecord.check_in_lng.toFixed(4)}</Badge>}
              </div>
              <div className="flex items-center gap-2"><LogOut className="w-3.5 h-3.5" /> <span className="font-medium">Checked out:</span> {todayRecord.check_out_at ? format(parseISO(todayRecord.check_out_at), 'p') : '—'}</div>
              {todayRecord.location && <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5" /> <span className="font-medium">Location:</span> <span className="text-muted-foreground">{todayRecord.location}</span></div>}
              <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> <span className="font-medium">Hours:</span> {hoursDisplay(todayRecord)} {statusBadge(todayRecord)}</div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleCheckIn} disabled={working || !!todayRecord?.check_in_at}>
              {working && !todayRecord?.check_in_at ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />} Check In
            </Button>
            <Button onClick={handleCheckOut} disabled={working || !todayRecord?.check_in_at || !!todayRecord?.check_out_at} variant="outline">
              {working && todayRecord?.check_in_at && !todayRecord?.check_out_at ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />} Check Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters + parameters */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><CalendarRange className="w-3 h-3" />Period</Label>
            <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="15">Last 15 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Instructor</Label>
            <Select value={instructorFilter} onValueChange={setInstructorFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                {instructorList.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="full">Full day</SelectItem>
                <SelectItem value="short">Short day</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expected hours / day</Label>
            <Input className="h-9" type="number" step="0.5" min="1" max="16" value={expectedHours} onChange={e => setExpectedHours(Number(e.target.value) || DEFAULT_EXPECTED_HOURS)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shift start (late after)</Label>
            <Input className="h-9" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Search</Label>
            <Input className="h-9" placeholder="Name, location, date…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {kpiCards.map(k => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-xl font-semibold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="mb-3">
          <TabsTrigger value="summary">Instructor Summary</TabsTrigger>
          <TabsTrigger value="calendar">{rangeDays}-Day Grid</TabsTrigger>
          <TabsTrigger value="records">Daily Records</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Attendance %</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Avg Hours</TableHead>
                    <TableHead>Full</TableHead>
                    <TableHead>Short</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Missed Out</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Last Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perInstructor.length === 0 && <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No data for this period.</TableCell></TableRow>}
                  {perInstructor.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>{i.present}</TableCell>
                      <TableCell>{i.absent}</TableCell>
                      <TableCell>
                        <Badge variant={i.rate >= 80 ? 'default' : i.rate >= 60 ? 'secondary' : 'destructive'}>{i.rate}%</Badge>
                      </TableCell>
                      <TableCell>{minutesToHm(i.totalMins)}</TableCell>
                      <TableCell>{i.avgMins ? minutesToHm(i.avgMins) : '—'}</TableCell>
                      <TableCell>{i.full}</TableCell>
                      <TableCell>{i.short}</TableCell>
                      <TableCell>{i.late > 0 ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" />{i.late}</span> : 0}</TableCell>
                      <TableCell>{i.missing}</TableCell>
                      <TableCell>{i.lastSeen !== '—' ? format(parseISO(i.lastSeen), 'dd MMM') : '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={i.lastLocation}>{i.lastLocation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-3 overflow-x-auto">
              <div className="flex gap-3 mb-3 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Full day</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Short day</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" /> In progress</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted inline-block border" /> No record</span>
              </div>
              <table className="text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background text-left px-2 py-1 min-w-[150px]">Instructor</th>
                    {days.map(d => (
                      <th key={d} className="px-0.5 py-1 font-normal text-muted-foreground">
                        {format(parseISO(d), 'dd')}
                        <div>{format(parseISO(d), 'EEEEE')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perInstructor.map(i => (
                    <tr key={i.id}>
                      <td className="sticky left-0 bg-background px-2 py-1 font-medium whitespace-nowrap">{i.name}</td>
                      {days.map(d => {
                        const r = cellFor(i.id, d);
                        const s = r ? statusOf(r) : 'none';
                        const color =
                          s === 'full' ? 'bg-emerald-500' :
                          s === 'short' ? 'bg-amber-500' :
                          s === 'in_progress' ? 'bg-sky-500' :
                          s === 'pending' ? 'bg-muted border' : 'bg-muted/50 border';
                        return (
                          <td key={d} className="px-0.5 py-0.5">
                            <div
                              className={`w-4 h-4 rounded-sm ${color}`}
                              title={r
                                ? `${i.name} · ${d}\nIn: ${r.check_in_at ? format(parseISO(r.check_in_at), 'p') : '—'}\nOut: ${r.check_out_at ? format(parseISO(r.check_out_at), 'p') : '—'}\nHours: ${hoursDisplay(r)}\n${r.location ?? ''}`
                                : `${i.name} · ${d}\nNo record`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? <p className="text-muted-foreground text-sm p-4">Loading…</p>
                : filteredRecords.length === 0 ? <p className="text-muted-foreground text-sm p-4">No records match the filters.</p>
                : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Instructor</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Late</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>GPS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium whitespace-nowrap">{format(parseISO(r.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-muted-foreground">{format(parseISO(r.date), 'EEE')}</TableCell>
                          <TableCell className="font-medium">{r.instructor_name}</TableCell>
                          <TableCell>{r.check_in_at ? format(parseISO(r.check_in_at), 'p') : '—'}</TableCell>
                          <TableCell>{r.check_out_at ? format(parseISO(r.check_out_at), 'p') : '—'}</TableCell>
                          <TableCell>{hoursDisplay(r)}</TableCell>
                          <TableCell>{isLate(r) ? <Badge variant="destructive">Late</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>{statusBadge(r)}</TableCell>
                          <TableCell className="max-w-xs truncate" title={r.location ?? ''}>{r.location ?? '—'}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {r.check_in_lat != null ? `${r.check_in_lat.toFixed(3)}, ${r.check_in_lng.toFixed(3)}` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default InstructorAttendance;
