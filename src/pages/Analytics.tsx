import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart3, Users, School as SchoolIcon, GraduationCap, TrendingUp, Percent, Download } from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#f97316', '#10b981', '#a855f7'];

const ATTENDED = new Set(['Present', 'Kit', 'Quiz']);

const Analytics = () => {
  const { role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (role !== 'admin') return;
    (async () => {
      setLoading(true);
      const [st, cl, sc, at, pa] = await Promise.all([
        supabase.from('students').select('id, class_id'),
        supabase.from('classes').select('id, name, school_id, day, grade'),
        supabase.from('schools').select('id, name'),
        supabase.from('attendance').select('id, student_id, status, date'),
        supabase.from('payments').select('id, amount, status, school_id'),
      ]);
      if (st.error || cl.error || sc.error) toast.error('Failed to load analytics');
      setStudents(st.data ?? []);
      setClasses(cl.data ?? []);
      setSchools(sc.data ?? []);
      setAttendance(at.data ?? []);
      setPayments(pa.data ?? []);
      setLoading(false);
    })();
  }, [role]);

  // 1. Kids per Program
  const kidsByProgram = useMemo(() => {
    const classById = new Map(classes.map(c => [c.id, c]));
    const counts = new Map<string, number>();
    students.forEach(s => {
      const c = classById.get(s.class_id);
      const prog = c?.name ?? 'Unassigned';
      counts.set(prog, (counts.get(prog) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([program_name, count]) => ({ program_name, count }))
      .sort((a, b) => b.count - a.count);
  }, [students, classes]);

  // 2. Kids per School
  const kidsBySchool = useMemo(() => {
    const classById = new Map(classes.map(c => [c.id, c]));
    const schoolById = new Map(schools.map(s => [s.id, s.name]));
    const counts = new Map<string, number>();
    students.forEach(s => {
      const c = classById.get(s.class_id);
      const name = schoolById.get(c?.school_id) ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([school_name, count]) => ({ school_name, count }))
      .sort((a, b) => b.count - a.count);
  }, [students, classes, schools]);

  // 3. Attendance rate per program
  const attendanceByProgram = useMemo(() => {
    const classById = new Map(classes.map(c => [c.id, c]));
    const studentClass = new Map(students.map(s => [s.id, s.class_id]));
    const map = new Map<string, { present: number; total: number }>();
    attendance.forEach(a => {
      const cid = studentClass.get(a.student_id);
      const c = classById.get(cid);
      const prog = c?.name ?? 'Unassigned';
      const cur = map.get(prog) ?? { present: 0, total: 0 };
      cur.total += 1;
      if (ATTENDED.has(a.status)) cur.present += 1;
      map.set(prog, cur);
    });
    return Array.from(map.entries())
      .map(([program, v]) => ({ program, rate: v.total ? Math.round((v.present / v.total) * 1000) / 10 : 0, sessions: v.total }))
      .sort((a, b) => b.rate - a.rate);
  }, [attendance, students, classes]);

  // 4. Classes per school
  const classesBySchool = useMemo(() => {
    const schoolById = new Map(schools.map(s => [s.id, s.name]));
    const counts = new Map<string, number>();
    classes.forEach(c => {
      const name = schoolById.get(c.school_id) ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([school, count]) => ({ school, count })).sort((a, b) => b.count - a.count);
  }, [classes, schools]);

  // 5. Day-wise class distribution
  const classesByDay = useMemo(() => {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const counts = new Map<string, number>();
    classes.forEach(c => { const d = c.day || 'Unassigned'; counts.set(d, (counts.get(d) ?? 0) + 1); });
    return order.filter(d => counts.has(d)).map(d => ({ day: d, count: counts.get(d)! }));
  }, [classes]);

  // 6. Payments summary per school
  const paymentsBySchool = useMemo(() => {
    const schoolById = new Map(schools.map(s => [s.id, s.name]));
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
  }, [payments, schools]);

  // Overall metrics
  const overallAttendance = useMemo(() => {
    if (!attendance.length) return 0;
    const present = attendance.filter(a => ATTENDED.has(a.status)).length;
    return Math.round((present / attendance.length) * 1000) / 10;
  }, [attendance]);

  const exportProgramExcel = () => {
    exportToExcel({
      filename: 'Kids_Enrolled_By_Program.xlsx',
      sheetName: 'By Program',
      rows: kidsByProgram.map((r, i) => ({ '#': i + 1, 'Program Name': r.program_name, 'Total Kids Enrolled': r.count })),
    });
    toast.success('Exported');
  };

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Analytics</h1>
        <p className="page-subtitle">Business insights across programs, schools, attendance and payments.</p>
      </div>

      {loading ? <p className="text-muted-foreground">Loading analytics…</p> : (
        <div className="space-y-6">
          {/* Overview cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><SchoolIcon className="w-3.5 h-3.5" /> Schools</div><div className="text-2xl font-bold mt-1">{schools.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Classes</div><div className="text-2xl font-bold mt-1">{classes.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Students</div><div className="text-2xl font-bold mt-1">{students.length}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Overall Attendance</div><div className="text-2xl font-bold mt-1">{overallAttendance}%</div></CardContent></Card>
          </div>

          {/* 1. Kids per program (primary requested table) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Total Kids Enrolled per Program</CardTitle>
              <Button size="sm" variant="outline" onClick={exportProgramExcel}><Download className="w-3.5 h-3.5 mr-1" /> Excel</Button>
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
            </CardContent>
          </Card>

          {/* 3. Attendance rate per program */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Attendance Rate by Program</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Sessions Logged</TableHead>
                    <TableHead className="text-right">Attendance Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceByProgram.map(r => (
                    <TableRow key={r.program}>
                      <TableCell className="font-medium">{r.program}</TableCell>
                      <TableCell className="text-right">{r.sessions}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.rate >= 80 ? 'default' : r.rate >= 60 ? 'secondary' : 'destructive'}>{r.rate}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {attendanceByProgram.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No attendance data.</TableCell></TableRow>}
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
