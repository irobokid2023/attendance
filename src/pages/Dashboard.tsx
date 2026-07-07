import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import { isAttended } from '@/lib/attendanceUtils';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import OnboardingTour from '@/components/OnboardingTour';
import StatCard from '@/components/StatCard';
import { School, BookOpen, Users, TrendingUp, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';


const Dashboard = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
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
      // Include holidays whose range overlaps today..today+30, not only those starting in-range.
      const { data } = await supabase
        .from('holidays')
        .select('*, schools(name)')
        .lte('date', in30)
        .or(`end_date.gte.${today},and(end_date.is.null,date.gte.${today})`)
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

      {/* Top Stats — schools/classes/students hidden for non-admin */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-1 max-w-sm'} gap-4 mb-8`}>
        {isAdmin && <StatCard title="Schools" value={stats.schools} icon={School} variant="primary" />}
        {isAdmin && <StatCard title="Classes" value={stats.classes} icon={BookOpen} variant="accent" />}
        {isAdmin && <StatCard title="Students" value={stats.students} icon={Users} variant="success" />}
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
              {upcomingHolidays.map(h => {
                const start = parseISO(h.date);
                const end = h.end_date ? parseISO(h.end_date) : start;
                const isRange = h.end_date && h.end_date !== h.date;
                return (
                  <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors shrink-0 w-[300px] snap-start">
                    <div className="text-center min-w-[48px] rounded-lg bg-primary/10 p-2">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">{format(start, 'MMM')}</p>
                      <p className="text-lg font-bold text-primary leading-tight">{format(start, 'dd')}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{h.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isRange ? `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}` : format(start, 'dd MMM yyyy')}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-1 font-normal">{(h as any).schools?.name}</Badge>
                      {h.description && <p className="text-xs text-muted-foreground mt-1 truncate">{h.description}</p>}
                    </div>
                  </div>
                );
              })}
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

