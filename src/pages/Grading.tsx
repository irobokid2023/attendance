import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Award, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import ExportDropdown from '@/components/ExportDropdown';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';

const GRADE_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Average'] as const;
type GradeValue = typeof GRADE_OPTIONS[number];

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const Grading = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [grading, setGrading] = useState<Record<string, GradeValue | ''>>({});
  const [existingGrading, setExistingGrading] = useState<Record<string, GradeValue | ''>>({});
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('mark');

  // Records state
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

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
    let classes = allClasses.filter(c => c.school_id === filterSchool);
    if (filterDay && filterDay !== 'all') {
      classes = classes.filter(c => c.day === filterDay);
    }
    return classes;
  }, [allClasses, filterSchool, filterDay]);

  const availableDays = useMemo(() => {
    if (!filterSchool) return [];
    const days = new Set(allClasses.filter(c => c.school_id === filterSchool).map(c => c.day).filter(Boolean));
    return [...days].sort();
  }, [allClasses, filterSchool]);

  useEffect(() => { setFilterClass(''); setFilterDay(''); }, [filterSchool]);

  // Fetch students & existing grading
  useEffect(() => {
    if (!filterClass) { setStudents([]); return; }
    const fetchData = async () => {
      const [studentsRes, gradingRes] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', filterClass).order('full_name'),
        supabase.from('grading').select('*').eq('class_id', filterClass).eq('date', dateStr),
      ]);
      setStudents(studentsRes.data ?? []);
      const gradingMap: Record<string, GradeValue | ''> = {};
      (gradingRes.data ?? []).forEach((g: any) => {
        gradingMap[g.student_id] = g.grade_value as GradeValue;
      });
      setGrading({ ...gradingMap });
      setExistingGrading({ ...gradingMap });
    };
    fetchData();
  }, [filterClass, dateStr]);

  // Fetch records when switching to records tab
  useEffect(() => {
    if (activeTab !== 'records' || !filterClass) { setRecords([]); return; }
    const fetchRecords = async () => {
      setRecordsLoading(true);
      const { data } = await supabase
        .from('grading')
        .select('*, students(full_name, grade, div)')
        .eq('class_id', filterClass)
        .order('date', { ascending: false });
      setRecords(data ?? []);
      setRecordsLoading(false);
    };
    fetchRecords();
  }, [activeTab, filterClass]);

  const handleGradeChange = (studentId: string, grade: GradeValue) => {
    setGrading(prev => ({
      ...prev,
      [studentId]: prev[studentId] === grade ? '' : grade,
    }));
  };

  const handleSave = async () => {
    if (!user || !filterClass) return;
    const entries = Object.entries(grading).filter(([, v]) => v);
    if (entries.length === 0) {
      toast.error('Please assign at least one grade');
      return;
    }
    setSaving(true);
    try {
      // Delete existing grading for this class+date
      const existingIds = Object.keys(existingGrading).filter(k => existingGrading[k]);
      if (existingIds.length > 0) {
        await supabase.from('grading').delete().eq('class_id', filterClass).eq('date', dateStr);
      }

      const rows = entries.map(([studentId, gradeValue]) => ({
        student_id: studentId,
        class_id: filterClass,
        date: dateStr,
        grade_value: gradeValue,
        marked_by: user.id,
      }));
      const { error } = await supabase.from('grading').insert(rows);
      if (error) throw error;
      toast.success('Grading saved successfully');
      setExistingGrading({ ...grading });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save grading');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(grading) !== JSON.stringify(existingGrading);

  const handleExport = (type: 'excel' | 'pdf') => {
    const data = records.map(r => ({
      Date: r.date,
      'Student Name': r.students?.full_name ?? '',
      Grade: r.students?.grade ?? '',
      Division: r.students?.div ?? '',
      'Grade Value': r.grade_value,
    }));
    const schoolName = schools.find(s => s.id === filterSchool)?.name ?? 'School';
    const cls = allClasses.find(c => c.id === filterClass);
    const className = cls ? getClassName(cls) : 'Class';
    const exportTitle = `Grading Records - ${schoolName} - ${className}`;
    if (type === 'excel') {
      exportToExcel({ rows: data, filename: exportTitle });
    } else {
      const headers = ['Date', 'Student Name', 'Grade', 'Division', 'Grade Value'];
      const pdfRows = data.map(d => [d.Date, d['Student Name'], d.Grade, d.Division, d['Grade Value']]);
      exportToPdf({ title: exportTitle, headers, rows: pdfRows, filename: exportTitle });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="w-6 h-6 text-primary" /> Grading
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Assign grades to students</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={filterSchool} onValueChange={setFilterSchool}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select School" />
            </SelectTrigger>
            <SelectContent>
              {schools.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterClass} onValueChange={setFilterClass} disabled={!filterSchool}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {filteredClasses.map(c => (
                <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDay} onValueChange={setFilterDay} disabled={!filterSchool}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Select Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              {availableDays.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filterClass && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="mark">Mark Grading</TabsTrigger>
              <TabsTrigger value="records">View Records</TabsTrigger>
            </TabsList>

            <TabsContent value="mark" className="space-y-4">
              {/* Date Picker */}
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-56 justify-start text-left font-normal')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              {students.length > 0 ? (
                <>
                  <div className="rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Division</TableHead>
                          {GRADE_OPTIONS.map(g => (
                            <TableHead key={g} className="text-center">{g}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student, idx) => (
                          <TableRow key={student.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{student.full_name}</TableCell>
                            <TableCell>{student.grade || '-'}</TableCell>
                            <TableCell>{student.div || '-'}</TableCell>
                            {GRADE_OPTIONS.map(g => (
                              <TableCell key={g} className="text-center">
                                <Checkbox
                                  checked={grading[student.id] === g}
                                  onCheckedChange={() => handleGradeChange(student.id, g)}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving || !hasChanges}>
                      {saving ? 'Saving...' : 'Save Grading'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No students found for the selected class.
                </div>
              )}
            </TabsContent>

            <TabsContent value="records" className="space-y-4">
              <div className="flex justify-end">
                <ExportDropdown
                  onExportExcel={() => handleExport('excel')}
                  onExportPdf={() => handleExport('pdf')}
                />
              </div>

              {recordsLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading records...</div>
              ) : records.length > 0 ? (
                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead>Grade Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r, idx) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{format(new Date(r.date), 'dd MMM yyyy')}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{r.students?.full_name ?? '-'}</TableCell>
                          <TableCell>{r.students?.grade ?? '-'}</TableCell>
                          <TableCell>{r.students?.div ?? '-'}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              r.grade_value === 'Excellent' && 'bg-success/10 text-success border-success/20',
                              r.grade_value === 'Very Good' && 'bg-primary/10 text-primary border-primary/20',
                              r.grade_value === 'Good' && 'bg-warning/10 text-warning border-warning/20',
                              r.grade_value === 'Average' && 'bg-muted text-muted-foreground border-muted',
                            )} variant="outline">
                              {r.grade_value}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No grading records found for the selected class.
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Grading;
