import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { IndianRupee, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import ExportDropdown from '@/components/ExportDropdown';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';

type PaymentStatus = 'paid' | 'not_paid';

const statusConfig: Record<PaymentStatus, { label: string; icon: any; activeClass: string; idleClass: string; badgeClass: string }> = {
  paid: {
    label: 'Paid',
    icon: Check,
    activeClass: 'bg-success text-success-foreground border-success hover:bg-success/90',
    idleClass: 'bg-success/10 text-success hover:bg-success/20 border-success/20',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },
  not_paid: {
    label: 'Not Paid',
    icon: X,
    activeClass: 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90',
    idleClass: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const Payments = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentStatus>>({});
  const [existingPayments, setExistingPayments] = useState<Record<string, { id: string; status: PaymentStatus }>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('mark');

  // Records tab
  const [recordsSchool, setRecordsSchool] = useState('');
  const [recordsClass, setRecordsClass] = useState('');
  const [recordsStudents, setRecordsStudents] = useState<any[]>([]);
  const [recordsPayments, setRecordsPayments] = useState<Record<string, PaymentStatus>>({});
  const [recordsLoading, setRecordsLoading] = useState(false);

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
    if (filterDay && filterDay !== 'all') classes = classes.filter(c => c.day === filterDay);
    return classes;
  }, [allClasses, filterSchool, filterDay]);

  const recordsFilteredClasses = useMemo(() => {
    if (!recordsSchool) return [];
    return allClasses.filter(c => c.school_id === recordsSchool);
  }, [allClasses, recordsSchool]);

  const availableDays = useMemo(() => {
    if (!filterSchool) return [];
    const days = new Set(allClasses.filter(c => c.school_id === filterSchool).map(c => c.day).filter(Boolean));
    return [...days].sort();
  }, [allClasses, filterSchool]);

  useEffect(() => { setFilterClass(''); setFilterDay(''); }, [filterSchool]);
  useEffect(() => { setRecordsClass(''); }, [recordsSchool]);

  // Fetch students & existing payments for Mark tab
  useEffect(() => {
    if (!filterClass) {
      setStudents([]); setPayments({}); setExistingPayments({});
      return;
    }
    const fetchData = async () => {
      const [studentsData, paymentsData] = await Promise.all([
        fetchAllPaginated<any>(() =>
          supabase.from('students').select('*').eq('class_id', filterClass).order('full_name'),
        ),
        fetchAllPaginated<{ id: string; student_id: string; status: PaymentStatus }>(() =>
          supabase.from('payments').select('id, student_id, status').eq('class_id', filterClass),
        ),
      ]);
      setStudents(studentsData);
      const map: Record<string, PaymentStatus> = {};
      const existing: Record<string, { id: string; status: PaymentStatus }> = {};
      paymentsData.forEach(p => {
        map[p.student_id] = p.status;
        existing[p.student_id] = { id: p.id, status: p.status };
      });
      setPayments(map);
      setExistingPayments(existing);
    };
    fetchData();
  }, [filterClass]);

  // Records tab
  useEffect(() => {
    if (activeTab !== 'records' || !recordsClass) {
      setRecordsStudents([]); setRecordsPayments({});
      return;
    }
    const fetchRecords = async () => {
      setRecordsLoading(true);
      const [studentsData, paymentsData] = await Promise.all([
        fetchAllPaginated<any>(() =>
          supabase.from('students').select('*').eq('class_id', recordsClass).order('full_name'),
        ),
        fetchAllPaginated<{ student_id: string; status: PaymentStatus }>(() =>
          supabase.from('payments').select('student_id, status').eq('class_id', recordsClass),
        ),
      ]);
      setRecordsStudents(studentsData);
      const map: Record<string, PaymentStatus> = {};
      paymentsData.forEach(p => { map[p.student_id] = p.status; });
      setRecordsPayments(map);
      setRecordsLoading(false);
    };
    fetchRecords();
  }, [activeTab, recordsClass]);

  const setStudentStatus = (studentId: string, status: PaymentStatus) => {
    setPayments(prev => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: PaymentStatus) => {
    const updated: Record<string, PaymentStatus> = {};
    students.forEach(s => { updated[s.id] = status; });
    setPayments(prev => ({ ...prev, ...updated }));
  };

  const handleSave = async () => {
    if (!user || !filterClass || !filterSchool) return;
    const entries = Object.entries(payments);
    if (entries.length === 0) {
      toast.error('No payment entries to save');
      return;
    }
    setSaving(true);

    try {
      const toUpsert = entries.map(([student_id, status]) => ({
        school_id: filterSchool,
        class_id: filterClass,
        student_id,
        status,
        marked_by: user.id,
      }));

      const { error } = await supabase
        .from('payments')
        .upsert(toUpsert, { onConflict: 'class_id,student_id' });

      if (error) throw error;

      toast.success('Payments saved!');
      const cls = allClasses.find(c => c.id === filterClass);
      logActivity({
        action: 'created',
        section: 'payments',
        description: `Saved payments for ${cls ? getClassName(cls) : 'class'}`,
      });

      // Refresh existing
      const refreshed = await fetchAllPaginated<{ id: string; student_id: string; status: PaymentStatus }>(() =>
        supabase.from('payments').select('id, student_id, status').eq('class_id', filterClass),
      );
      const existing: Record<string, { id: string; status: PaymentStatus }> = {};
      refreshed.forEach(p => { existing[p.student_id] = { id: p.id, status: p.status }; });
      setExistingPayments(existing);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save payments');
    } finally {
      setSaving(false);
    }
  };

  const paidCount = useMemo(
    () => students.filter(s => payments[s.id] === 'paid').length,
    [students, payments],
  );
  const notPaidCount = useMemo(
    () => students.filter(s => payments[s.id] === 'not_paid').length,
    [students, payments],
  );

  const handleRecordsExport = (type: 'excel' | 'pdf') => {
    const schoolName = schools.find(s => s.id === recordsSchool)?.name ?? 'School';
    const cls = allClasses.find(c => c.id === recordsClass);
    const className = cls ? getClassName(cls) : 'Class';
    const title = `Payment Records - ${schoolName} - ${className}`;

    const rows = recordsStudents.map((s, idx) => ({
      '#': idx + 1,
      'Student Name': s.full_name,
      Grade: s.grade ?? '',
      Division: s.div ?? '',
      Status: recordsPayments[s.id] ? statusConfig[recordsPayments[s.id]].label : 'Not Marked',
    }));

    if (type === 'excel') {
      exportToExcel({ rows, filename: title });
    } else {
      const headers = ['#', 'Student Name', 'Grade', 'Division', 'Status'];
      const pdfRows = rows.map(r => [String(r['#']), r['Student Name'], r.Grade, r.Division, r.Status]);
      exportToPdf({ title, headers, rows: pdfRows, filename: title });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <IndianRupee className="w-6 h-6 text-primary" /> Payments
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Mark payment status and view records</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="mark">Mark Payments</TabsTrigger>
            <TabsTrigger value="records">View Records</TabsTrigger>
          </TabsList>

          {/* MARK TAB */}
          <TabsContent value="mark" className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select value={filterSchool} onValueChange={(v) => { setFilterSchool(v); setFilterClass(''); setFilterDay(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select School" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterClass} onValueChange={setFilterClass} disabled={!filterSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Class Name" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDay} onValueChange={setFilterDay} disabled={!filterSchool}>
                <SelectTrigger>
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

            {!filterSchool && (
              <div className="text-center py-12 text-muted-foreground">
                Please select a school to maintain payment records.
              </div>
            )}

            {filterSchool && !filterClass && (
              <div className="text-center py-12 text-muted-foreground">
                Select a class to view its students.
              </div>
            )}

            {filterClass && students.length > 0 && (
              <>
                {/* Stats + bulk actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      Paid: {paidCount}
                    </Badge>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      Not Paid: {notPaidCount}
                    </Badge>
                    <Badge variant="outline">Total: {students.length}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => markAll('paid')}>
                      Mark All Paid
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markAll('not_paid')}>
                      Mark All Not Paid
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead className="text-center">Payment Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => {
                        const current = payments[student.id];
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{student.full_name}</TableCell>
                            <TableCell>{student.grade || '-'}</TableCell>
                            <TableCell>{student.div || '-'}</TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                {(['paid', 'not_paid'] as PaymentStatus[]).map(s => {
                                  const cfg = statusConfig[s];
                                  const Icon = cfg.icon;
                                  const isActive = current === s;
                                  return (
                                    <Button
                                      key={s}
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setStudentStatus(student.id, s)}
                                      className={cn('border', isActive ? cfg.activeClass : cfg.idleClass)}
                                    >
                                      <Icon className="w-3.5 h-3.5 mr-1" />
                                      {cfg.label}
                                    </Button>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Payments'}
                  </Button>
                </div>
              </>
            )}

            {filterClass && students.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No students found for the selected class.
              </div>
            )}
          </TabsContent>

          {/* RECORDS TAB */}
          <TabsContent value="records" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select value={recordsSchool} onValueChange={setRecordsSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select School" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={recordsClass} onValueChange={setRecordsClass} disabled={!recordsSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Class Name" />
                </SelectTrigger>
                <SelectContent>
                  {recordsFilteredClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!recordsClass && (
              <div className="text-center py-12 text-muted-foreground">
                Select a school and class to view payment records.
              </div>
            )}

            {recordsClass && (
              <>
                <div className="flex justify-end">
                  <ExportDropdown
                    onExportExcel={() => handleRecordsExport('excel')}
                    onExportPdf={() => handleRecordsExport('pdf')}
                  />
                </div>

                {recordsLoading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading records...</div>
                ) : recordsStudents.length > 0 ? (
                  <div className="rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Division</TableHead>
                          <TableHead>Payment Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recordsStudents.map((s, idx) => {
                          const status = recordsPayments[s.id];
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium">{s.full_name}</TableCell>
                              <TableCell>{s.grade || '-'}</TableCell>
                              <TableCell>{s.div || '-'}</TableCell>
                              <TableCell>
                                {status ? (
                                  <Badge variant="outline" className={statusConfig[status].badgeClass}>
                                    {statusConfig[status].label}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                                    Not Marked
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No students found for the selected class.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
