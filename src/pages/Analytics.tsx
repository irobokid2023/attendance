import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart3, Users, School as SchoolIcon, GraduationCap, TrendingUp, Percent, Download, FileText, RefreshCw } from 'lucide-react';
import { exportToExcelMultiSheet } from '@/lib/exportExcel';
import { exportMultiTablePdf } from '@/lib/exportPdfMulti';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f97316', '#10b981', '#a855f7'];

const ATTENDED = new Set(['present', 'kit', 'quiz']);
const isAttended = (s: any) => ATTENDED.has(String(s ?? '').toLowerCase());

const rateBadge = (rate: number): 'default' | 'secondary' | 'destructive' =>
  rate >= 80 ? 'default' : rate >= 60 ? 'secondary' : 'destructive';

const Analytics = () => {
  const { role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const inFlight = useRef(false);

  const loadAll = useCallback(async (initial = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    initial ? setLoading(true) : setRefreshing(true);
    try {
      const [st, cl, sc, at, pa] = await Promise.all([
        fetchAllPaginated<any>(() => supabase.from('students').select('id, class_id, grade')),
        fetchAllPaginated<any>(() => supabase.from('classes').select('id, name, school_id, day, grade')),
        fetchAllPaginated<any>(() => supabase.from('schools').select('id, name')),
        fetchAllPaginated<any>(() => supabase.from('attendance').select('id, student_id, class_id, status, date')),
        fetchAllPaginated<any>(() => supabase.from('payments').select('id, amount, status, school_id')),
      ]);
      setStudents(st);
      setClasses(cl);
      setSchools(sc);
      setAttendance(at);
      setPayments(pa);
      setLastUpdated(new Date());
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + live updates (realtime, polling, window focus)
  useEffect(() => {
    if (role !== 'admin') return;
    loadAll(true);

    let debounce: any;
    const bump = () => { clearTimeout(debounce); debounce = setTimeout(() => loadAll(), 800); };

    const channel = supabase.channel('analytics-live');
    ['students', 'classes', 'schools', 'attendance', 'payments'].forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, bump);
    });
    channel.subscribe();

    const onFocus = () => loadAll();
    window.addEventListener('focus', onFocus);
    const poll = setInterval(() => loadAll(), 60000);

    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, [role, loadAll]);

  const classById = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes]);
  const schoolById = useMemo(() => new Map(schools.map(s => [s.id, s.name])), [schools]);
  const studentClass = useMemo(() => new Map(students.map(s => [s.id, s.class_id])), [students]);

  // 1. Kids per Program
  const kidsByProgram = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach(s => {
      const prog = classById.get(s.class_id)?.name ?? 'Unassigned';
      counts.set(prog, (counts.get(prog) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([program_name, count]) => ({ program_name, count }))
      .sort((a, b) => b.count - a.count);
  }, [students, classById]);

  // 2. Kids per School
  const kidsBySchool = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach(s => {
      const c = classById.get(s.class_id);
      const name = schoolById.get(c?.school_id) ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([school_name, count]) => ({ school_name, count }))
      .sort((a, b) => b.count - a.count);
  }, [students, classById, schoolById]);

  // 3. Attendance rate per program
  const attendanceByProgram = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    attendance.forEach(a => {
      const cid = a.class_id ?? studentClass.get(a.student_id);
      const prog = classById.get(cid)?.name ?? 'Unassigned';
      const cur = map.get(prog) ?? { present: 0, total: 0 };
      cur.total += 1;
      if (isAttended(a.status)) cur.present += 1;
      map.set(prog, cur);
    });
    const studentsPerProgram = new Map(kidsByProgram.map(k => [k.program_name, k.count]));
    return Array.from(map.entries())
      .map(([program, v]) => ({
        program,
        students: studentsPerProgram.get(program) ?? 0,
        records: v.total,
        rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [attendance, studentClass, classById, kidsByProgram]);

  // 3b. Attendance rate per school
  const attendanceBySchool = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    attendance.forEach(a => {
      const cid = a.class_id ?? studentClass.get(a.student_id);
      const c = classById.get(cid);
      const name = schoolById.get(c?.school_id) ?? 'Unassigned';
      const cur = map.get(name) ?? { present: 0, total: 0 };
      cur.total += 1;
      if (isAttended(a.status)) cur.present += 1;
      map.set(name, cur);
    });
    const studentsPerSchool = new Map(kidsBySchool.map(k => [k.school_name, k.count]));
    const classesPerSchool = new Map<string, number>();
    classes.forEach(c => {
      const name = schoolById.get(c.school_id) ?? 'Unassigned';
      classesPerSchool.set(name, (classesPerSchool.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([school, v]) => ({
        school,
        students: studentsPerSchool.get(school) ?? 0,
        programs: classesPerSchool.get(school) ?? 0,
        records: v.total,
        rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [attendance, studentClass, classById, schoolById, kidsBySchool, classes]);

  // 4. Classes per school
  const classesBySchool = useMemo(() => {
    const counts = new Map<string, number>();
    classes.forEach(c => {
      const name = schoolById.get(c.school_id) ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([school, count]) => ({ school, count })).sort((a, b) => b.count - a.count);
  }, [classes, schoolById]);

  // 5. Day-wise class distribution
  const classesByDay = useMemo(() => {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const counts = new Map<string, number>();
    classes.forEach(c => { const d = c.day || 'Unassigned'; counts.set(d, (counts.get(d) ?? 0) + 1); });
    return order.filter(d => counts.has(d)).map(d => ({ day: d, count: counts.get(d)! }));
  }, [classes]);

  // 6. Payments summary per school
  const paymentsBySchool = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number }>();
    payments.forEach(p => {
      const name = schoolById.get(p.school_id) ?? 'Unassigned';
      const cur = map.get(name) ?? { paid: 0, pending: 0 };
      const amt = Number(p.amount ?? 0);
      if ((p.status || '').toLowerCase() === 'paid') cur.paid += amt;
      else cur.pending += amt;
      map.set(name, cur);
    });
    return Array.from(map.entries()).map(([school, v]) => ({ school, ...v, total: v.paid + v.pending }))
      .sort((a, b) => b.total - a.total);
  }, [payments, schoolById]);

  const overallAttendance = useMemo(() => {
    if (!attendance.length) return 0;
    const present = attendance.filter(a => isAttended(a.status)).length;
    return Math.round((present / attendance.length) * 1000) / 10;
  }, [attendance]);

  const sessionsConducted = useMemo(() => {
    const set = new Set(attendance.map(a => `${a.class_id ?? studentClass.get(a.student_id)}|${a.date}`));
    return set.size;
  }, [attendance, studentClass]);

  // ---- Exports ----
  const buildExportData = () => ({
    programRows: kidsByProgram.map((r, i) => ({ '#': i + 1, 'Program Name': r.program_name, 'Total Kids Enrolled': r.count })),
    schoolRows: kidsBySchool.map((r, i) => ({ '#': i + 1, 'School Name': r.school_name, 'Total Kids Enrolled': r.count })),
    programAttRows: attendanceByProgram.map(r => ({
      'Program': r.program, 'Students': r.students, 'Attendance Records': r.records, 'Attendance %': r.rate,
    })),
    schoolAttRows: attendanceBySchool.map(r => ({
      'School': r.school, 'Programs / Classes': r.programs, 'Students': r.students, 'Attendance Records': r.records, 'Attendance %': r.rate,
    })),
    paymentRows: paymentsBySchool.map(r => ({
      'School': r.school, 'Paid': r.paid, 'Pending': r.pending, 'Total': r.total,
    })),
  });

  const exportAllExcel = () => {
    const d = buildExportData();
    exportToExcelMultiSheet({
      filename: 'Analytics_Report.xlsx',
      sheets: [
        { name: 'Kids by Program', rows: d.programRows },
        { name: 'Kids by School', rows: d.schoolRows },
        { name: 'Attendance by Program', rows: d.programAttRows },
        { name: 'Attendance by School', rows: d.schoolAttRows },
        { name: 'Payments by School', rows: d.paymentRows },
      ],
    });
    toast.success('Excel exported');
  };

  const exportAllPdf = () => {
    const d = buildExportData();
    const toSection = (heading: string, rows: Record<string, any>[]) => ({
      heading,
      headers: rows.length ? Object.keys(rows[0]) : [],
      rows: rows.map(r => Object.values(r) as (string | number)[]),
    });
    exportMultiTablePdf({
      title: 'Analytics Report',
      subtitle: 'Programs, Schools, Students & Attendance',
      kpis: [
        { label: 'Schools', value: schools.length },
        { label: 'Classes / Programs', value: classes.length },
        { label: 'Students', value: students.length },
        { label: 'Sessions Conducted', value: sessionsConducted },
        { label: 'Overall Attendance', value: `${overallAttendance}%` },
      ],
      sections: [
        toSection('Total Kids Enrolled per Program', d.programRows),
        toSection('Total Kids Enrolled per School', d.schoolRows),
        toSection('Attendance % by Program', d.programAttRows),
        toSection('Attendance % by School', d.schoolAttRows),
        toSection('Payments Summary by School', d.paymentRows),
      ],
    });
  };

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Analytics</h1>
          <p className="page-subtitle">
            Live insights across programs, schools, attendance and payments.
            {lastUpdated && <span className="ml-1 text-xs">Updated {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => loadAll()} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportAllExcel}><Download className="w-3.5 h-3.5 mr-1" /> Export Excel</Button>
          <Button size="sm" onClick={exportAllPdf}><FileText className="w-3.5 h-3.5 mr-1" /> Export PDF</Button>
        </div>
      </div>

      {loading ? <p className="text-muted-foreground">Loading analytics…</p> : (
        <div className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><SchoolIcon className="w-3.5 h-3.5" /> Schools</div><div className="text-2xl font-bold mt-1">{schools.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Classes</div><div className="text-2xl font-bold mt-1">{classes.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Students</div><div className="text-2xl font-bold mt-1">{students.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Sessions</div><div className="text-2xl font-bold mt-1">{sessionsConducted}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Overall Attendance</div><div className="text-2xl font-bold mt-1">{overallAttendance}%</div></CardContent></Card>
          </div>

          {/* 1. Kids per program */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Total Kids Enrolled per Program</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-2 gap-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Program Name</TableHead>
                      <TableHead className="text-right">Total Kids</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kidsByProgram.map((r, i) => (
                      <TableRow key={r.program_name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.program_name}</TableCell>
                        <TableCell className="text-right"><Badge variant="secondary">{r.count}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {kidsByProgram.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No students yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={kidsByProgram} dataKey="count" nameKey="program_name" outerRadius={110} label={(e: any) => e.count}>
                        {kidsByProgram.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Kids per School */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><SchoolIcon className="w-4 h-4" /> Kids Enrolled per School</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-2 gap-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead className="text-right">Total Kids</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kidsBySchool.map((r, i) => (
                      <TableRow key={r.school_name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.school_name}</TableCell>
                        <TableCell className="text-right"><Badge variant="secondary">{r.count}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {kidsBySchool.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No students yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kidsBySchool}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="school_name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={80} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0ea5e9" name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Attendance % by program */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Attendance Percentage by Program</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Attendance Records</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceByProgram.map(r => (
                    <TableRow key={r.program}>
                      <TableCell className="font-medium">{r.program}</TableCell>
                      <TableCell className="text-right">{r.students}</TableCell>
                      <TableCell className="text-right">{r.records}</TableCell>
                      <TableCell className="text-right"><Badge variant={rateBadge(r.rate)}>{r.rate}%</Badge></TableCell>
                    </TableRow>
                  ))}
                  {attendanceByProgram.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No attendance data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 3b. Attendance % by school */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Percent className="w-4 h-4" /> Attendance Percentage by School</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Programs / Classes</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Attendance Records</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceBySchool.map(r => (
                    <TableRow key={r.school}>
                      <TableCell className="font-medium">{r.school}</TableCell>
                      <TableCell className="text-right">{r.programs}</TableCell>
                      <TableCell className="text-right">{r.students}</TableCell>
                      <TableCell className="text-right">{r.records}</TableCell>
                      <TableCell className="text-right"><Badge variant={rateBadge(r.rate)}>{r.rate}%</Badge></TableCell>
                    </TableRow>
                  ))}
                  {attendanceBySchool.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No attendance data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 4/5 grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Classes per School</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classesBySchool} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="school" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Day-wise Class Load</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classesByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 6. Payments summary */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Payments Summary by School</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Paid (₹)</TableHead>
                    <TableHead className="text-right">Pending (₹)</TableHead>
                    <TableHead className="text-right">Total (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsBySchool.map(r => (
                    <TableRow key={r.school}>
                      <TableCell className="font-medium">{r.school}</TableCell>
                      <TableCell className="text-right">{r.paid.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">{r.pending.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-semibold">{r.total.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                  {paymentsBySchool.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No payment data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Analytics;
