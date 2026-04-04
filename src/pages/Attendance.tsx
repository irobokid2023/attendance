import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ClipboardCheck, Check, X, Calendar as CalendarIcon, FileText, Package, HelpCircle, LogOut, Plus } from 'lucide-react';
import { cn, capitalizeWords } from '@/lib/utils';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';
import ExportDropdown from '@/components/ExportDropdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type Status = 'present' | 'absent' | 'kit' | 'quiz' | 'left';

const statusConfig: Record<Status, { label: string; icon: any; className: string }> = {
  present: { label: 'Present', icon: Check, className: 'bg-success/10 text-success hover:bg-success/20 border-success/20' },
  absent: { label: 'Absent', icon: X, className: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20' },
  kit: { label: 'Kit', icon: Package, className: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20' },
  quiz: { label: 'Quiz', icon: HelpCircle, className: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20' },
  left: { label: 'Left', icon: LogOut, className: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/20' },
};

const recordStatusConfig: Record<Status, { label: string; className: string }> = {
  present: { label: 'P', className: 'bg-success/10 text-success border-success/20' },
  absent: { label: 'A', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  kit: { label: 'K', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  quiz: { label: 'Q', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  left: { label: 'L', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
};

const ALL_STATUSES: Status[] = ['present', 'absent', 'kit', 'quiz', 'left'];

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const Attendance = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);
  const [sessionStats, setSessionStats] = useState<{ total: number; perStudent: Record<string, number> }>({ total: 0, perStudent: {} });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [topic, setTopic] = useState('');
  const [activeTab, setActiveTab] = useState('mark');
  const [changeDateOpen, setChangeDateOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [changingDate, setChangingDate] = useState(false);

  // Multiple sessions per day
  const [existingSessions, setExistingSessions] = useState<string[]>([]); // list of topics for date
  const [selectedSession, setSelectedSession] = useState<string | null>(null); // topic of session being edited, null = new
  const [isNewSession, setIsNewSession] = useState(false);

  // Records state - sessionKeys are "date|topic" composites
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, Status>>>({});
  const [sessionKeys, setSessionKeys] = useState<string[]>([]);
  const [sessionInfoMap, setSessionInfoMap] = useState<Record<string, { date: string; topic: string }>>({});

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

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

  // Fetch students & attendance for Mark tab
  useEffect(() => {
    if (!filterClass) {
      setStudents([]); setSessionStats({ total: 0, perStudent: {} }); setTopic('');
      setExistingSessions([]); setSelectedSession(null); setIsNewSession(false);
      return;
    }

    const fetchAll = async () => {
      const [studentsRes, allAttendanceRes, dateAttendanceRes] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', filterClass).order('full_name'),
        supabase.from('attendance').select('student_id, date, status, topic').eq('class_id', filterClass),
        supabase.from('attendance').select('student_id, status, topic').eq('class_id', filterClass).eq('date', dateStr),
      ]);

      setStudents(studentsRes.data ?? []);

      // Session stats - count unique date|topic combinations
      const allRecords = allAttendanceRes.data ?? [];
      const distinctSessions = new Set(allRecords.map(r => `${r.date}|${(r as any).topic || ''}`));
      const perStudent: Record<string, number> = {};
      allRecords.forEach(r => {
        if (r.status === 'present') perStudent[r.student_id] = (perStudent[r.student_id] || 0) + 1;
      });
      setSessionStats({ total: distinctSessions.size, perStudent });

      // Sessions for this date (grouped by topic)
      const dateRecords = dateAttendanceRes.data ?? [];
      const topicSet = new Set<string>();
      dateRecords.forEach(r => { if ((r as any).topic) topicSet.add((r as any).topic); });
      const topics = [...topicSet];
      setExistingSessions(topics);

      if (topics.length > 0 && !isNewSession) {
        // Load first session by default
        const firstTopic = topics[0];
        setSelectedSession(firstTopic);
        setTopic(firstTopic);
        const existing: Record<string, Status> = {};
        dateRecords.forEach(a => {
          if ((a as any).topic === firstTopic) existing[a.student_id] = a.status as Status;
        });
        setAttendance(existing);
      } else if (isNewSession) {
        // New session mode - clear
        setAttendance({});
        setTopic('');
      } else {
        setSelectedSession(null);
        setAttendance({});
        setTopic('');
      }
    };

    fetchAll();
  }, [filterClass, dateStr]);

  // Load specific session when user selects one
  const loadSession = async (sessionTopic: string) => {
    setSelectedSession(sessionTopic);
    setTopic(sessionTopic);
    setIsNewSession(false);
    const { data } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', filterClass)
      .eq('date', dateStr)
      .eq('topic', sessionTopic);
    const existing: Record<string, Status> = {};
    (data ?? []).forEach(a => { existing[a.student_id] = a.status as Status; });
    setAttendance(existing);
  };

  const startNewSession = () => {
    setIsNewSession(true);
    setSelectedSession(null);
    setAttendance({});
    setTopic('');
  };

  // Fetch records data when switching to records tab
  useEffect(() => {
    if (activeTab !== 'records' || !filterClass) { setAttendanceMap({}); setSessionKeys([]); setSessionInfoMap({}); return; }

    const fetchRecords = async () => {
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', filterClass).order('full_name'),
        supabase.from('attendance').select('student_id, date, status, topic').eq('class_id', filterClass).order('date', { ascending: false }),
      ]);

      setStudents(studentsRes.data ?? []);

      const records = attendanceRes.data ?? [];
      // Build composite keys: "date|topic"
      const keySet = new Set<string>();
      const infoMap: Record<string, { date: string; topic: string }> = {};
      const map: Record<string, Record<string, Status>> = {};

      records.forEach(r => {
        const topic = r.topic || '';
        const key = `${r.date}|${topic}`;
        keySet.add(key);
        infoMap[key] = { date: r.date, topic };
        if (!map[r.student_id]) map[r.student_id] = {};
        map[r.student_id][key] = r.status as Status;
      });

      // Sort keys by date desc, then topic
      const sortedKeys = [...keySet].sort((a, b) => {
        const [dateA] = a.split('|');
        const [dateB] = b.split('|');
        return dateB.localeCompare(dateA) || a.localeCompare(b);
      });

      setSessionKeys(sortedKeys);
      setSessionInfoMap(infoMap);
      setAttendanceMap(map);
    };

    fetchRecords();
  }, [activeTab, filterClass]);

  const filteredStudents = useMemo(() => students, [students]);

  const cycleStudentStatus = (studentId: string) => {
    setAttendance(prev => {
      const current = prev[studentId];
      const currentIndex = current ? ALL_STATUSES.indexOf(current) : -1;
      const nextIndex = (currentIndex + 1) % ALL_STATUSES.length;
      return { ...prev, [studentId]: ALL_STATUSES[nextIndex] };
    });
  };

  const setStudentStatus = (studentId: string, status: Status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!topic.trim()) { toast.error('Topic of the Day is required'); setSaving(false); return; }
    setSaving(true);

    const trimmedTopic = capitalizeWords(topic.trim());

    // If editing an existing session, delete old records first
    if (selectedSession) {
      await supabase
        .from('attendance')
        .delete()
        .eq('class_id', filterClass)
        .eq('date', dateStr)
        .eq('topic', selectedSession);
    }

    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id,
      class_id: filterClass,
      date: dateStr,
      status,
      marked_by: user.id,
      topic: trimmedTopic,
    }));

    if (records.length === 0) {
      toast.info('No attendance to save');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('attendance').insert(records);
    if (error) toast.error(error.message);
    else {
      toast.success('Attendance saved!');
      setSelectedSession(trimmedTopic);
      setIsNewSession(false);
      // Refresh sessions list
      const { data } = await supabase
        .from('attendance')
        .select('topic')
        .eq('class_id', filterClass)
        .eq('date', dateStr);
      const topicSet = new Set<string>();
      (data ?? []).forEach(r => { if (r.topic) topicSet.add(r.topic); });
      setExistingSessions([...topicSet]);
    }
    setSaving(false);
  };

  const handleChangeDate = async () => {
    if (!user || !filterClass || !selectedSession) return;
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    if (newDateStr === dateStr) { toast.info('Same date selected'); return; }
    setChangingDate(true);

    const { error } = await supabase
      .from('attendance')
      .update({ date: newDateStr })
      .eq('class_id', filterClass)
      .eq('date', dateStr)
      .eq('topic', selectedSession);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Attendance date changed to ${format(newDate, 'PPP')}`);
      setSelectedDate(newDate);
      setChangeDateOpen(false);
    }
    setChangingDate(false);
  };

  const markAll = (status: Status) => {
    const updated: Record<string, Status> = {};
    filteredStudents.forEach(s => { updated[s.id] = status; });
    setAttendance(prev => ({ ...prev, ...updated }));
  };

  // Export for Mark tab
  const handleExportExcel = () => {
    const rows = filteredStudents.map(s => ({
      'Student Name': s.full_name,
      'Grade': s.grade ?? '',
      'Division': s.div ?? '',
      'Sessions Attended': sessionStats.perStudent[s.id] || 0,
      'Total Sessions': sessionStats.total,
      'Status': attendance[s.id] ? statusConfig[attendance[s.id]].label : 'Not marked',
    }));
    exportToExcel({ filename: 'attendance.xlsx', sheetName: 'Attendance', rows });
  };

  const handleExportPdf = () => {
    const headers = ['Student', 'Grade', 'Div', 'Attended', 'Total', 'Status'];
    const rows = filteredStudents.map(s => [
      s.full_name, s.grade ?? '—', s.div ?? '—',
      String(sessionStats.perStudent[s.id] || 0), String(sessionStats.total),
      attendance[s.id] ? recordStatusConfig[attendance[s.id]].label : '-',
    ]);
    exportToPdf({ title: `Attendance - ${format(selectedDate, 'PPP')}`, headers, rows, filename: 'attendance.pdf' });
  };

  // Export for Records tab
  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const handleRecordsExportExcel = () => {
    const rows = filteredStudents.map(s => {
      const rec = attendanceMap[s.id] || {};
      const attended = sessionKeys.filter(k => rec[k] === 'present').length;
      const row: Record<string, any> = { 'Student Name': s.full_name, 'Total': `${attended}/${sessionKeys.length}` };
      sessionKeys.forEach(k => {
        const info = sessionInfoMap[k];
        const label = `${formatDate(info.date)} (${getDayName(info.date)})${info.topic ? ' - ' + info.topic : ''}`;
        row[label] = rec[k] ? recordStatusConfig[rec[k]].label : '-';
      });
      return row;
    });
    exportToExcel({ filename: 'attendance_records.xlsx', sheetName: 'Records', rows });
  };

  const handleRecordsExportPdf = () => {
    const headers = ['Student', 'Total', ...sessionKeys.map(k => { const info = sessionInfoMap[k]; return `${formatDate(info.date)}${info.topic ? '\n' + info.topic : ''}`; })];
    const rows = filteredStudents.map(s => {
      const rec = attendanceMap[s.id] || {};
      const attended = sessionKeys.filter(k => rec[k] === 'present').length;
      return [s.full_name, `${attended}/${sessionKeys.length}`, ...sessionKeys.map(k => rec[k] ? recordStatusConfig[rec[k]].label : '-')];
    });
    exportToPdf({ title: 'Attendance Records', headers, rows, filename: 'attendance_records.pdf' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-primary" /> Attendance
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Mark attendance and view records</p>
          </div>
        </div>

        {/* Filters: School → Class Name → Day */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Select value={filterSchool} onValueChange={(v) => { setFilterSchool(v); setFilterClass(''); setFilterDay(''); }}>
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

        {filterClass ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
              <TabsTrigger value="records">View Records</TabsTrigger>
            </TabsList>

            {/* ===== MARK ATTENDANCE TAB ===== */}
            <TabsContent value="mark" className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Date</label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-[200px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(selectedDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={selectedDate} onSelect={(d) => { if (d) { setSelectedDate(d); setIsNewSession(false); setSelectedSession(null); } }} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    {selectedSession && (
                      <Button size="sm" variant="outline" onClick={() => { setNewDate(selectedDate); setChangeDateOpen(true); }}>
                        Change Date
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <label className="text-sm font-medium text-foreground">Topic of the Day *</label>
                  <Input placeholder="Enter the topic covered today..." value={topic} onChange={e => setTopic(e.target.value)} className="max-w-md" required />
                </div>

                <ExportDropdown onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} />
              </div>

              {/* Session selector for multiple sessions per day */}
              {existingSessions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Sessions on this date:</span>
                  {existingSessions.map(t => (
                    <Button
                      key={t}
                      size="sm"
                      variant={selectedSession === t && !isNewSession ? 'default' : 'outline'}
                      onClick={() => loadSession(t)}
                    >
                      {t}
                    </Button>
                  ))}
                  <Button size="sm" variant={isNewSession ? 'default' : 'outline'} onClick={startNewSession}>
                    <Plus className="w-3 h-3 mr-1" /> New Session
                  </Button>
                </div>
              )}

              {filteredStudents.length > 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground mr-2">Quick:</span>
                      {ALL_STATUSES.map(s => (
                        <Button key={s} size="sm" variant="outline" onClick={() => markAll(s)} className={statusConfig[s].className}>
                          {statusConfig[s].label}
                        </Button>
                      ))}
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Total Sessions: {sessionStats.total}
                    </Badge>
                  </div>

                  <div className="bg-card rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead className="text-center">Sessions Attended</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((s, i) => {
                          const currentStatus = attendance[s.id];
                          const attended = sessionStats.perStudent[s.id] || 0;
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-medium">{s.full_name}</TableCell>
                              <TableCell className="text-center">
                                <span className="font-semibold">{attended}</span>
                                <span className="text-muted-foreground"> / {sessionStats.total}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const config = currentStatus ? statusConfig[currentStatus] : null;
                                  return (
                                    <button
                                      onClick={() => cycleStudentStatus(s.id)}
                                      className={cn(
                                        'px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer min-w-[70px] text-center',
                                        config ? config.className + ' ring-1 ring-offset-1' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/60'
                                      )}
                                    >
                                      {config ? config.label : 'Mark'}
                                    </button>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No students found for the selected class.
                </div>
              )}
            </TabsContent>

            {/* ===== VIEW RECORDS TAB ===== */}
            <TabsContent value="records" className="space-y-4">
              {filteredStudents.length > 0 && sessionKeys.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      Total Sessions: {sessionKeys.length}
                    </Badge>
                    <ExportDropdown onExportExcel={handleRecordsExportExcel} onExportPdf={handleRecordsExportPdf} />
                  </div>

                  <div className="bg-card rounded-xl border overflow-hidden">
                    <ScrollArea className="w-full">
                      <div className="min-w-max">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 sticky left-0 bg-card z-10">#</TableHead>
                              <TableHead className="sticky left-10 bg-card z-10 min-w-[150px]">Student</TableHead>
                              <TableHead className="sticky left-[200px] bg-card z-10 min-w-[80px]">Total</TableHead>
                              {sessionKeys.map(key => {
                                const info = sessionInfoMap[key];
                                return (
                                  <TableHead key={key} className="text-center min-w-[100px]">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-xs font-semibold">{formatDate(info.date)}</span>
                                      <span className="text-[10px] text-muted-foreground">{getDayName(info.date)}</span>
                                      {info.topic && (
                                        <span className="text-[10px] text-primary truncate max-w-[90px]" title={info.topic}>
                                          {info.topic}
                                        </span>
                                      )}
                                    </div>
                                  </TableHead>
                                );
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map((s, i) => {
                              const studentRecords = attendanceMap[s.id] || {};
                              const attended = sessionKeys.filter(k => studentRecords[k] === 'present').length;
                              return (
                                <TableRow key={s.id}>
                                  <TableCell className="text-muted-foreground sticky left-0 bg-card z-10">{i + 1}</TableCell>
                                  <TableCell className="font-medium sticky left-10 bg-card z-10">{s.full_name}</TableCell>
                                  <TableCell className="sticky left-[200px] bg-card z-10 text-center">
                                    <span className="font-semibold">{attended}</span>
                                    <span className="text-muted-foreground text-xs"> /{sessionKeys.length}</span>
                                  </TableCell>
                                  {sessionKeys.map(key => {
                                    const status = studentRecords[key] as Status | undefined;
                                    const config = status ? recordStatusConfig[status] : null;
                                    return (
                                      <TableCell key={key} className="text-center">
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
              ) : filteredStudents.length > 0 && sessionKeys.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No attendance sessions recorded yet.</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No students found for the selected class.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-20">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a school and class to mark attendance.</p>
          </div>
        )}
      </div>

      <Dialog open={changeDateOpen} onOpenChange={setChangeDateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Attendance Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current date: <strong>{format(selectedDate, 'PPP')}</strong>
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">New Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeDateOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeDate} disabled={changingDate}>
              {changingDate ? 'Updating...' : 'Update Date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Attendance;
