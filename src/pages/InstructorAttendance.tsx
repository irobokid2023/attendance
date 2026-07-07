import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut, MapPin, Users2, Loader2 } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';

const EXPECTED_MINUTES = 8 * 60 + 30;

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

const InstructorAttendance = () => {
  const { user, role } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [scope, setScope] = useState<'me' | 'all'>('me');

  const loadRecords = async () => {
    if (!user) return;
    setLoading(true);
    let q = (supabase as any).from('instructor_attendance').select('*').order('date', { ascending: false }).limit(500);
    if (scope === 'me' || role !== 'admin') q = q.eq('instructor_id', user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRecords((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, [user, scope, role]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayRecord = useMemo(
    () => records.find(r => r.instructor_id === user?.id && r.date === todayStr),
    [records, user, todayStr]
  );

  const handleCheckIn = async () => {
    if (!user) return;
    setWorking(true);
    const geo = await getGeolocation();
    if (!geo) {
      toast.error('GPS location required. Please enable location services and try again.');
      setWorking(false);
      return;
    }
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
    if (!geo) {
      toast.error('GPS location required. Please enable location services and try again.');
      setWorking(false);
      return;
    }
    const patch: any = {
      check_out_at: new Date().toISOString(),
      check_out_lat: geo.lat,
      check_out_lng: geo.lng,
    };
    const { error } = await (supabase as any)
      .from('instructor_attendance')
      .update(patch)
      .eq('id', todayRecord.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Checked out successfully');
      logActivity({ action: 'updated', section: 'instructor_attendance', description: `Checked out on ${todayStr}` });
      loadRecords();
    }
    setWorking(false);
  };

  const hoursDisplay = (r: any) => {
    if (!r.check_in_at || !r.check_out_at) return '—';
    const mins = differenceInMinutes(parseISO(r.check_out_at), parseISO(r.check_in_at));
    return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  };
  const isFullDay = (r: any) => r.check_in_at && r.check_out_at && differenceInMinutes(parseISO(r.check_out_at), parseISO(r.check_in_at)) >= EXPECTED_MINUTES;

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Users2 className="w-6 h-6" /> My Attendance</h1>
        <p className="page-subtitle">Location is captured automatically via GPS. Expected: 8h 30m, Monday – Saturday.</p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Today — {format(new Date(), 'EEEE, dd MMM yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayRecord && (
            <div className="p-3 rounded-lg bg-muted/40 mb-4 text-sm space-y-1.5">
              <div className="flex items-center gap-2"><LogIn className="w-3.5 h-3.5" /> <span className="font-medium">Checked in:</span> {todayRecord.check_in_at ? format(parseISO(todayRecord.check_in_at), 'p') : '—'}
                {todayRecord.check_in_lat != null && <Badge variant="outline" className="ml-2 text-[10px]"><MapPin className="w-3 h-3 mr-1" />{todayRecord.check_in_lat.toFixed(4)}, {todayRecord.check_in_lng.toFixed(4)}</Badge>}
              </div>
              <div className="flex items-center gap-2"><LogOut className="w-3.5 h-3.5" /> <span className="font-medium">Checked out:</span> {todayRecord.check_out_at ? format(parseISO(todayRecord.check_out_at), 'p') : '—'}
                {todayRecord.check_out_lat != null && <Badge variant="outline" className="ml-2 text-[10px]"><MapPin className="w-3 h-3 mr-1" />{todayRecord.check_out_lat.toFixed(4)}, {todayRecord.check_out_lng.toFixed(4)}</Badge>}
              </div>
              {todayRecord.location && <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5" /> <span className="font-medium">Location:</span> <span className="text-muted-foreground">{todayRecord.location}</span></div>}
              <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> <span className="font-medium">Hours:</span> {hoursDisplay(todayRecord)}
                {isFullDay(todayRecord) ? <Badge className="ml-2">Full Day</Badge> : todayRecord.check_out_at && <Badge variant="destructive" className="ml-2">Short</Badge>}
              </div>
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

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Recent Records</CardTitle>
          {role === 'admin' && (
            <div className="flex gap-1">
              <Button size="sm" variant={scope === 'me' ? 'default' : 'outline'} onClick={() => setScope('me')}>Mine</Button>
              <Button size="sm" variant={scope === 'all' ? 'default' : 'outline'} onClick={() => setScope('all')}>All Instructors</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground text-sm">Loading…</p>
            : records.length === 0 ? <p className="text-muted-foreground text-sm">No records yet.</p>
            : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{format(parseISO(r.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="max-w-xs truncate" title={r.location ?? ''}>{r.location ?? '—'}</TableCell>
                        <TableCell>{r.check_in_at ? format(parseISO(r.check_in_at), 'p') : '—'}</TableCell>
                        <TableCell>{r.check_out_at ? format(parseISO(r.check_out_at), 'p') : '—'}</TableCell>
                        <TableCell>{hoursDisplay(r)}</TableCell>
                        <TableCell>
                          {!r.check_in_at ? <Badge variant="outline">Pending</Badge>
                            : !r.check_out_at ? <Badge variant="secondary">In Progress</Badge>
                            : isFullDay(r) ? <Badge>Full Day</Badge>
                            : <Badge variant="destructive">Short</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default InstructorAttendance;
