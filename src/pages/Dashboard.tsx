import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import { isAttended } from '@/lib/attendanceUtils';
import DashboardLayout from '@/components/DashboardLayout';
import OnboardingTour from '@/components/OnboardingTour';
import StatCard from '@/components/StatCard';
import { School, BookOpen, Users, TrendingUp, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';


const Dashboard = () => {
  const [stats, setStats] = useState({ schools: 0, classes: 0, students: 0, todayPresent: 0, todayAbsent: 0 });
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);


  useEffect(() => {
    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [schoolsRes, classesRes, studentsRes, att] = await Promise.all([
        supabase.from('schools').select('id, name', { count: 'exact' }),
        supabase.from('classes').select('id, name, school_id, grade, div', { count: 'exact' }),
        supabase.from('students').select('id, class_id', { count: 'exact' }),
        fetchAllPaginated<{ status: string; date: string; class_id: string; student_id: string }>(
          () => supabase.from('attendance').select('status, date, class_id, student_id'),
        ),
      ]);

      const schools = schoolsRes.data ?? [];
      const classes = classesRes.data ?? [];

      const todayAtt = att.filter(a => a.date === today);
      setStats({
        schools: schoolsRes.count ?? 0,
        classes: classesRes.count ?? 0,
        students: studentsRes.count ?? 0,
        todayPresent: todayAtt.filter(a => isAttended(a.status)).length,
        todayAbsent: todayAtt.filter(a => a.status === 'absent').length,
      });

    };


    const fetchHolidays = async () => {
      const todayDate = new Date();
      const today = todayDate.toISOString().split('T')[0];
      const in30 = new Date(todayDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      const { data } = await supabase
        .from('holidays')
        .select('*, schools(name)')
        .gte('date', today)
        .lte('date', in30)
        .order('date');
      setUpcomingHolidays(data ?? []);
    };

    fetchAll();
    fetchHolidays();
  }, []);

  const attendanceRate = stats.todayPresent + stats.todayAbsent > 0
    ? Math.round((stats.todayPresent / (stats.todayPresent + stats.todayAbsent)) * 100)
    : 0;

  const totalToday = stats.todayPresent + stats.todayAbsent;




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
            <span className="text-xs font-normal text-muted-foreground ml-1">(next 30 days)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingHolidays.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth">
              {upcomingHolidays.map(h => (
                <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors shrink-0 w-[280px] snap-start">
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
            <p className="text-sm text-muted-foreground text-center py-8">No holidays in the next 30 days</p>
          )}
        </CardContent>
      </Card>


    </DashboardLayout>
  );
};

export default Dashboard;

