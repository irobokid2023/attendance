import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isAttended } from '@/lib/attendanceUtils';
import DashboardLayout from '@/components/DashboardLayout';
import OnboardingTour from '@/components/OnboardingTour';
import StatCard from '@/components/StatCard';
import { School, BookOpen, Users, TrendingUp, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState({ schools: 0, classes: 0, students: 0, todayPresent: 0, todayAbsent: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [schoolData, setSchoolData] = useState<any[]>([]);
  const [classData, setClassData] = useState<any[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [schoolsRes, classesRes, studentsRes, attendanceRes] = await Promise.all([
        supabase.from('schools').select('id, name', { count: 'exact' }),
        supabase.from('classes').select('id, name, school_id, grade, div', { count: 'exact' }),
        supabase.from('students').select('id, class_id', { count: 'exact' }),
        supabase.from('attendance').select('status, date, class_id, student_id'),
      ]);

      const schools = schoolsRes.data ?? [];
      const classes = classesRes.data ?? [];
      const att = attendanceRes.data ?? [];

      const todayAtt = att.filter(a => a.date === today);
      setStats({
        schools: schoolsRes.count ?? 0,
        classes: classesRes.count ?? 0,
        students: studentsRes.count ?? 0,
        todayPresent: todayAtt.filter(a => isAttended(a.status)).length,
        todayAbsent: todayAtt.filter(a => a.status === 'absent').length,
      });

      const uniqueDates = [...new Set(att.map(a => a.date))].sort().slice(-8);
      const weekly = uniqueDates.map(date => {
        const dayAtt = att.filter(a => a.date === date);
        const present = dayAtt.filter(a => isAttended(a.status)).length;
        const absent = dayAtt.filter(a => a.status === 'absent').length;
        const total = present + absent;
        return {
          date: format(parseISO(date), 'dd MMM'),
          present, absent,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      });
      setWeeklyData(weekly);

      const classToSchool: Record<string, string> = {};
      classes.forEach(c => { classToSchool[c.id] = c.school_id; });
      const schoolMap: Record<string, { name: string; present: number; total: number }> = {};
      schools.forEach(s => { schoolMap[s.id] = { name: s.name, present: 0, total: 0 }; });
      att.forEach(a => {
        const sid = classToSchool[a.class_id];
        if (sid && schoolMap[sid]) {
          schoolMap[sid].total++;
          if (isAttended(a.status)) schoolMap[sid].present++;
        }
      });
      setSchoolData(Object.values(schoolMap).map(s => ({
        name: s.name.length > 15 ? s.name.slice(0, 15) + '…' : s.name,
        rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
        present: s.present, total: s.total,
      })));

      const classMap: Record<string, { name: string; present: number; total: number }> = {};
      classes.forEach(c => {
        const label = [c.name, c.grade, c.div].filter(Boolean).join(' - ');
        classMap[c.id] = { name: label.length > 20 ? label.slice(0, 20) + '…' : label, present: 0, total: 0 };
      });
      att.forEach(a => {
        if (classMap[a.class_id]) {
          classMap[a.class_id].total++;
          if (isAttended(a.status)) classMap[a.class_id].present++;
        }
      });
      setClassData(
        Object.values(classMap)
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
          .map(c => ({
            name: c.name,
            rate: Math.round((c.present / c.total) * 100),
            present: c.present,
            absent: c.total - c.present,
          }))
      );
    };

    const fetchHolidays = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('holidays')
        .select('*, schools(name)')
        .gte('date', today)
        .order('date')
        .limit(50);
      setUpcomingHolidays(data ?? []);
    };

    fetchAll();
    fetchHolidays();
  }, []);

  const attendanceRate = stats.todayPresent + stats.todayAbsent > 0
    ? Math.round((stats.todayPresent / (stats.todayPresent + stats.todayAbsent)) * 100)
    : 0;

  const totalToday = stats.todayPresent + stats.todayAbsent;

  const rateConfig: ChartConfig = {
    rate: { label: 'Attendance %', color: 'hsl(var(--primary))' },
  };

  const classConfig: ChartConfig = {
    present: { label: 'Present', color: 'hsl(var(--success))' },
    absent: { label: 'Absent', color: 'hsl(var(--destructive))' },
  };

  return (
    <DashboardLayout>
      <OnboardingTour />
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your institute's attendance</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Schools" value={stats.schools} icon={School} variant="primary" />
        <StatCard title="Classes" value={stats.classes} icon={BookOpen} variant="accent" />
        <StatCard title="Students" value={stats.students} icon={Users} variant="success" />
        <StatCard title="Attendance Rate" value={`${attendanceRate}%`} icon={TrendingUp} variant="warning" />
      </div>

      {/* Upcoming Holidays */}
      <Card className="animate-fade-in mb-8 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <CalendarDays className="w-4 h-4 text-primary" /> Upcoming Holidays
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingHolidays.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingHolidays.map(h => (
                <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="text-center min-w-[48px] rounded-lg bg-primary/10 p-2">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">{format(parseISO(h.date), 'MMM')}</p>
                    <p className="text-lg font-bold text-primary leading-tight">{format(parseISO(h.date), 'dd')}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{h.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1 font-normal">{(h as any).schools?.name}</Badge>
                    {h.description && <p className="text-xs text-muted-foreground mt-1 truncate">{h.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming holidays</p>
          )}
        </CardContent>
      </Card>

      {/* Today's Breakdown & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="animate-fade-in shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Today's Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-3xl font-bold font-heading text-success">{stats.todayPresent}</p>
                <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">Present</p>
                {totalToday > 0 && <Progress value={(stats.todayPresent / totalToday) * 100} className="mt-3 h-1.5 [&>div]:bg-success" />}
              </div>
              <div>
                <p className="text-3xl font-bold font-heading text-destructive">{stats.todayAbsent}</p>
                <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">Absent</p>
                {totalToday > 0 && <Progress value={(stats.todayAbsent / totalToday) * 100} className="mt-3 h-1.5 [&>div]:bg-destructive" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in shadow-sm" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Attendance Rate Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.length > 0 ? (
              <ChartContainer config={rateConfig} className="h-[180px] w-full">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} fontSize={11} tickLine={false} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="rate" stroke="var(--color-rate)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No attendance data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* School & Class Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="animate-fade-in shadow-sm" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">School-wise Attendance %</CardTitle>
          </CardHeader>
          <CardContent>
            {schoolData.length > 0 ? (
              <ChartContainer config={rateConfig} className="h-[250px] w-full">
                <BarChart data={schoolData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} fontSize={11} unit="%" />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="rate" fill="var(--color-rate)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No school data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in shadow-sm" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Class-wise Breakdown (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {classData.length > 0 ? (
              <ChartContainer config={classConfig} className="h-[250px] w-full">
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} angle={-30} textAnchor="end" height={60} />
                  <YAxis fontSize={11} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="present" stackId="a" fill="var(--color-present)" />
                  <Bar dataKey="absent" stackId="a" fill="var(--color-absent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No class data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
