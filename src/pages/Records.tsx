import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isAttended } from '@/lib/attendanceUtils';
import DashboardLayout from '@/components/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Check, X, FileText, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';
import ExportDropdown from '@/components/ExportDropdown';

type Status = 'present' | 'absent';

const statusConfig: Record<Status, { label: string; icon: any; className: string }> = {
  present: { label: 'P', icon: Check, className: 'bg-success/10 text-success border-success/20' },
  absent: { label: 'A', icon: X, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const Records = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, Status>>>({});
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [topicMap, setTopicMap] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('classes').select('id, name, school_id, grade, div, day').order('name'),
    ]).then(([schoolsRes, classesRes]) => {
      setSchools(schoolsRes.data ?? []);
      setAllClasses(classesRes.data ?? []);
    });
  }, []);

  const filteredClasses = useMemo(() => {
    if (!filterSchool) return [];
    return allClasses.filter(c => c.school_id === filterSchool);
  }, [allClasses, filterSchool]);

  const availableDays = useMemo(() => {
    if (!filterSchool) return [];
    const days = new Set(allClasses.filter(c => c.school_id === filterSchool).map(c => c.day).filter(Boolean));
    return [...days].sort();
  }, [allClasses, filterSchool]);

  useEffect(() => { setFilterClass(''); setFilterDay(''); }, [filterSchool]);

  useEffect(() => {
    if (!filterClass) { setStudents([]); setAttendanceMap({}); setSessionDates([]); setTopicMap({}); return; }

    const fetchAll = async () => {
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', filterClass).order('full_name'),
        supabase.from('attendance').select('student_id, date, status, topic').eq('class_id', filterClass).order('date', { ascending: false }),
      ]);

      setStudents(studentsRes.data ?? []);

      const records = attendanceRes.data ?? [];
      const dates = [...new Set(records.map(r => r.date))].sort((a, b) => b.localeCompare(a));
      setSessionDates(dates);

      const map: Record<string, Record<string, Status>> = {};
      const topics: Record<string, string> = {};
      records.forEach(r => {
        if (!map[r.student_id]) map[r.student_id] = {};
        map[r.student_id][r.date] = r.status as Status;
        if ((r as any).topic && !(topics[r.date])) topics[r.date] = (r as any).topic;
      });
      setAttendanceMap(map);
      setTopicMap(topics);
    };

    fetchAll();
  }, [filterClass]);

  const filteredStudents = useMemo(() => students, [students]);

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const handleExportExcel = () => {
    const rows = filteredStudents.map(s => {
      const rec = attendanceMap[s.id] || {};
      const attended = sessionDates.filter(d => isAttended(rec[d])).length;
      const row: Record<string, any> = { 'Student Name': s.full_name, 'Total': `${attended}/${sessionDates.length}` };
      sessionDates.forEach(d => { row[`${formatDate(d)} (${getDayName(d)})`] = rec[d] === 'present' ? 'P' : rec[d] === 'absent' ? 'A' : '-'; });
      return row;
    });
    exportToExcel({ filename: 'attendance_records.xlsx', sheetName: 'Records', rows });
  };

  const handleExportPdf = () => {
    const headers = ['Student', 'Total', ...sessionDates.map(d => `${formatDate(d)}`)];
    const rows = filteredStudents.map(s => {
      const rec = attendanceMap[s.id] || {};
      const attended = sessionDates.filter(d => isAttended(rec[d])).length;
      return [s.full_name, `${attended}/${sessionDates.length}`, ...sessionDates.map(d => rec[d] === 'present' ? 'P' : rec[d] === 'absent' ? 'A' : '-')];
    });
    exportToPdf({ title: 'Attendance Records', headers, rows, filename: 'attendance_records.pdf' });
  };

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Attendance Records</h1>
          <p className="page-subtitle">View detailed session history with dates, days & topics</p>
        </div>
        {filterClass && filteredStudents.length > 0 && sessionDates.length > 0 && (
          <ExportDropdown onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} />
        )}
      </div>

      {/* Filters: School → Class Name → Day */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Select value={filterSchool} onValueChange={setFilterSchool}>
          <SelectTrigger><SelectValue placeholder="Select School" /></SelectTrigger>
          <SelectContent>
            {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setFilterDay(''); }} disabled={!filterSchool}>
          <SelectTrigger><SelectValue placeholder={filterSchool ? 'Select Class Name' : 'Select school first'} /></SelectTrigger>
          <SelectContent>
            {filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterDay} onValueChange={setFilterDay} disabled={!filterSchool}>
          <SelectTrigger><SelectValue placeholder="All Days" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Days</SelectItem>
            {availableDays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filterClass && filteredStudents.length > 0 && sessionDates.length > 0 && (
        <>
          <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 mb-4 w-fit">
            <Calendar className="w-3.5 h-3.5" />
            Total Sessions: {sessionDates.length}
          </Badge>

          <div className="bg-card rounded-xl border overflow-hidden">
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sticky left-0 bg-card z-10">#</TableHead>
                      <TableHead className="sticky left-10 bg-card z-10 min-w-[150px]">Student</TableHead>
                      <TableHead className="sticky left-[200px] bg-card z-10 min-w-[80px]">Total</TableHead>
                      {sessionDates.map(date => (
                        <TableHead key={date} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-semibold">{formatDate(date)}</span>
                            <span className="text-[10px] text-muted-foreground">{getDayName(date)}</span>
                            {topicMap[date] && (
                              <span className="text-[10px] text-primary truncate max-w-[90px]" title={topicMap[date]}>
                                {topicMap[date]}
                              </span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                      
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s, i) => {
                      const studentRecords = attendanceMap[s.id] || {};
                      const attended = sessionDates.filter(d => isAttended(studentRecords[d])).length;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground sticky left-0 bg-card z-10">{i + 1}</TableCell>
                          <TableCell className="font-medium sticky left-10 bg-card z-10">{s.full_name}</TableCell>
                          <TableCell className="sticky left-[200px] bg-card z-10 text-center">
                            <span className="font-semibold">{attended}</span>
                            <span className="text-muted-foreground text-xs"> /{sessionDates.length}</span>
                          </TableCell>
                          {sessionDates.map(date => {
                            const status = studentRecords[date];
                            const config = status ? statusConfig[status] : null;
                            return (
                              <TableCell key={date} className="text-center">
                                {config ? (
                                  <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold border', config.className)}>
                                    {config.label}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                          
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </>
      )}

      {filterClass && filteredStudents.length > 0 && sessionDates.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No attendance sessions recorded yet.</p>
        </div>
      )}

      {filterClass && filteredStudents.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No students found for the selected filters.</p>
        </div>
      )}

      {!filterClass && (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a school and class to view attendance records.</p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Records;
