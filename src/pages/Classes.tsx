import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeFields } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';
import SearchFilterBar from '@/components/SearchFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, BookOpen, School, Users, ArrowLeft, Trash2, Pencil, LayoutGrid, List, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';
import ExportDropdown from '@/components/ExportDropdown';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ROMAN_GRADES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

const formatTime12 = (h: number, m: string, p: string) => `${h}:${m} ${p}`;

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const parseTiming = (timing: string): { startH: number; startM: string; startP: string; endH: number; endM: string; endP: string } | null => {
  const match = timing.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  return { startH: parseInt(match[1]), startM: match[2], startP: match[3].toUpperCase(), endH: parseInt(match[4]), endM: match[5], endP: match[6].toUpperCase() };
};

const TimingPicker = ({ timing, onChange }: { timing: string; onChange: (v: string) => void }) => {
  const parsed = parseTiming(timing);
  const [startH, setStartH] = useState(parsed?.startH ?? 9);
  const [startM, setStartM] = useState(parsed?.startM ?? '00');
  const [startP, setStartP] = useState(parsed?.startP ?? 'AM');
  const [endH, setEndH] = useState(parsed?.endH ?? 10);
  const [endM, setEndM] = useState(parsed?.endM ?? '00');
  const [endP, setEndP] = useState(parsed?.endP ?? 'AM');

  useEffect(() => {
    onChange(`${formatTime12(startH, startM, startP)} - ${formatTime12(endH, endM, endP)}`);
  }, [startH, startM, startP, endH, endM, endP]);

  useEffect(() => {
    const p = parseTiming(timing);
    if (p) { setStartH(p.startH); setStartM(p.startM); setStartP(p.startP); setEndH(p.endH); setEndM(p.endM); setEndP(p.endP); }
  }, []);

  const timeSelect = (label: string, h: number, setH: (v: number) => void, m: string, setM: (v: string) => void, p: string, setP: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{label}</Label>
      <div className="flex gap-1">
        <Select value={String(h)} onValueChange={(v) => setH(parseInt(v))}>
          <SelectTrigger className="w-[60px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{HOURS.map((hr) => <SelectItem key={hr} value={String(hr)}>{hr}</SelectItem>)}</SelectContent>
        </Select>
        <span className="self-center text-muted-foreground font-bold">:</span>
        <Select value={m} onValueChange={setM}>
          <SelectTrigger className="w-[60px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{MINUTES.map((mn) => <SelectItem key={mn} value={mn}>{mn}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={p} onValueChange={setP}>
          <SelectTrigger className="w-[65px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((pr) => <SelectItem key={pr} value={pr}>{pr}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <Label>Timing *</Label>
      <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-muted/30">
        {timeSelect('Start Time', startH, setStartH, startM, setStartM, startP, setStartP)}
        {timeSelect('End Time', endH, setEndH, endM, setEndM, endP, setEndP)}
      </div>
    </div>
  );
};

interface ClassForm {
  name: string; // Program Name
  school_id: string;
  day: string;
  timing: string;
  num_sessions: number;
  instructor_names: string;
  venue: string;
  grade: string;
  div: string;
}

const emptyForm: ClassForm = { name: '', school_id: '', day: '', timing: '', num_sessions: 0, instructor_names: '', venue: '', grade: '', div: '' };

const Classes = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [form, setForm] = useState<ClassForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [filterSchool, setFilterSchool] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [customDiv, setCustomDiv] = useState(false);
  const [customGrade, setCustomGrade] = useState(false);

  const fetchData = async () => {
    const [classesRes, schoolsRes, attendanceRes] = await Promise.all([
      supabase.from('classes').select('*, schools(name)').order('created_at', { ascending: false }),
      supabase.from('schools').select('id, name'),
      supabase.from('attendance').select('class_id, date'),
    ]);
    setClasses(classesRes.data ?? []);
    setSchools(schoolsRes.data ?? []);
    const counts: Record<string, Set<string>> = {};
    (attendanceRes.data ?? []).forEach((r) => { if (!counts[r.class_id]) counts[r.class_id] = new Set(); counts[r.class_id].add(r.date); });
    const result: Record<string, number> = {};
    Object.entries(counts).forEach(([id, dates]) => { result[id] = dates.size; });
    setSessionCounts(result);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchStudents = useCallback(async (classId: string) => {
    setStudentsLoading(true);
    const { data } = await supabase.from('students').select('*').eq('class_id', classId).order('roll_number', { ascending: true });
    setStudents(data ?? []);
    setStudentsLoading(false);
  }, []);

  const handleSelectClass = (classId: string) => { setSelectedClassId(classId); fetchStudents(classId); };
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const filtered = useMemo(() => {
    let result = classes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.schools?.name ?? '').toLowerCase().includes(search.toLowerCase()));
    if (filterSchool !== 'all') result = result.filter((c) => c.school_id === filterSchool);
    if (sort === 'name-asc') result.sort((a: any, b: any) => a.name.localeCompare(b.name));
    else if (sort === 'name-desc') result.sort((a: any, b: any) => b.name.localeCompare(a.name));
    else if (sort === 'oldest') result.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    return result;
  }, [classes, search, sort, filterSchool]);

  const grouped = useMemo(() => {
    const map = new Map<string, { schoolName: string; classes: any[] }>();
    filtered.forEach((cls) => {
      const key = cls.school_id;
      const schoolName = cls.schools?.name ?? 'Unknown School';
      if (!map.has(key)) map.set(key, { schoolName, classes: [] });
      map.get(key)!.classes.push(cls);
    });
    return Array.from(map.values()).sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [filtered]);

  const setField = (key: keyof ClassForm, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAddDialog = () => { setEditId(null); setForm(emptyForm); setCustomDiv(false); setCustomGrade(false); setOpen(true); };
  const openEditDialog = (cls: any) => {
    setEditId(cls.id);
    const gradeVal = cls.grade ?? '';
    const divVal = cls.div ?? '';
    setCustomGrade(gradeVal !== '' && !ROMAN_GRADES.includes(gradeVal));
    setCustomDiv(divVal !== '' && !DIVISIONS.includes(divVal));
    setForm({ name: cls.name, school_id: cls.school_id, day: cls.day ?? '', timing: cls.timing ?? '', num_sessions: cls.num_sessions ?? 0, instructor_names: cls.instructor_names ?? '', venue: cls.venue ?? '', grade: gradeVal, div: divVal });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.name === '__custom__') { toast.error('Program Name is required'); return; }
    if (!form.grade) { toast.error('Grade is required'); return; }
    if (!form.div) { toast.error('Division is required'); return; }
    if (!form.day) { toast.error('Day is required'); return; }
    if (!form.instructor_names.trim()) { toast.error('Instructor Name is required'); return; }
    if (!form.venue.trim()) { toast.error('Venue is required'); return; }
    setLoading(true);
    const payload = capitalizeFields({ ...form }, ['instructor_names', 'venue']);
    if (editId) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editId);
      if (error) toast.error(error.message);
      else { toast.success('Class updated!'); setOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from('classes').insert(payload);
      if (error) toast.error(error.message);
      else { toast.success('Class added!'); setOpen(false); fetchData(); }
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map((c) => c.id)));

  const handleDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('classes').delete().in('id', ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} class(es) deleted`); setSelected(new Set()); fetchData(); }
    setDeleting(false);
    setDeleteOpen(false);
  };

  const handleExport = () => {
    exportToExcel({ filename: 'classes.xlsx', sheetName: 'Classes', rows: filtered.map((c) => ({
      'Class Name': getClassName(c), 'Program Name': c.name, School: c.schools?.name ?? '', Grade: c.grade ?? '', Division: c.div ?? '', Day: c.day ?? '', Timing: c.timing ?? '',
      'No. of Sessions': c.num_sessions ?? 0, 'Sessions Conducted': sessionCounts[c.id] || 0,
      Instructors: c.instructor_names ?? '', Venue: c.venue ?? '',
    })) });
  };

  const handleExportPdf = () => {
    const headers = ['Class Name', 'School', 'Grade', 'Div', 'Day', 'Timing', 'Sessions', 'Instructors'];
    const rows = filtered.map(c => [
      getClassName(c), c.schools?.name ?? '', c.grade ?? '—', c.div ?? '—', c.day ?? '—', c.timing ?? '—',
      `${sessionCounts[c.id] || 0}/${c.num_sessions ?? 0}`, c.instructor_names ?? '—',
    ]);
    exportToPdf({ title: 'Classes Report', headers, rows, filename: 'classes.pdf' });
  };

  const classFormFields = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Program Name *</Label>
        {form.name === '__custom__' || (form.name && ![
          '3D - Designing and Printing',
          '3D - Designing and Printing + Drone',
          'Advance Python Programming',
          'App Inventor',
          'Arduino Electronics and Programming',
          'Arduino Robotics',
          'Coding (Scratch)',
          'Coding AI',
          'Electrics and Circuits (Breadboard Kit)',
          'Electrics and Circuits (Snap Kit)',
          'Lego Robotics - Ev3',
          'Lego Robotics - NxT',
          'Python Programming',
           'STEM Explorers',
           'Young Engineers',
        ].includes(form.name)) && form.name !== '' ? (
          <div className="flex gap-2">
            <Input value={form.name === '__custom__' ? '' : form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Enter custom program name" required />
            <Button type="button" variant="outline" size="sm" onClick={() => setField('name', '')}>List</Button>
          </div>
        ) : (
          <Select value={form.name} onValueChange={(v) => { if (v === '__custom__') setField('name', '__custom__'); else setField('name', v); }}>
            <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3D - Designing and Printing">3D - Designing and Printing</SelectItem>
              <SelectItem value="3D - Designing and Printing + Drone">3D - Designing and Printing + Drone</SelectItem>
              <SelectItem value="Advance Python Programming">Advance Python Programming</SelectItem>
              <SelectItem value="App Inventor">App Inventor</SelectItem>
              <SelectItem value="Arduino Electronics and Programming">Arduino Electronics and Programming</SelectItem>
              <SelectItem value="Arduino Robotics">Arduino Robotics</SelectItem>
              <SelectItem value="Coding (Scratch)">Coding (Scratch)</SelectItem>
              <SelectItem value="Coding AI">Coding AI</SelectItem>
              <SelectItem value="Electrics and Circuits (Breadboard Kit)">Electrics and Circuits (Breadboard Kit)</SelectItem>
              <SelectItem value="Electrics and Circuits (Snap Kit)">Electrics and Circuits (Snap Kit)</SelectItem>
              <SelectItem value="Lego Robotics - Ev3">Lego Robotics - Ev3</SelectItem>
              <SelectItem value="Lego Robotics - NxT">Lego Robotics - NxT</SelectItem>
              <SelectItem value="Python Programming">Python Programming</SelectItem>
              <SelectItem value="STEM Explorers">STEM Explorers</SelectItem>
              <SelectItem value="Young Engineers">Young Engineers</SelectItem>
              <SelectItem value="__custom__">Custom</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-2">
        <Label>School *</Label>
        <Select value={form.school_id} onValueChange={(v) => setField('school_id', v)} required>
          <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
          <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Grade *</Label>
        {customGrade ? (
          <div className="flex gap-2">
            <Input value={form.grade} onChange={(e) => setField('grade', e.target.value)} placeholder="Enter grade" />
            <Button type="button" variant="outline" size="sm" onClick={() => { setCustomGrade(false); setField('grade', ''); }}>List</Button>
          </div>
        ) : (
          <Select value={form.grade} onValueChange={(v) => { if (v === '__custom_grade__') { setCustomGrade(true); setField('grade', ''); } else setField('grade', v); }}>
            <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
            <SelectContent>
              {ROMAN_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              <SelectItem value="__custom_grade__">Custom...</SelectItem>
            </SelectContent>
          </Select>
        )}
        </div>
        <div className="space-y-2">
          <Label>Division *</Label>
          {customDiv ? (
            <div className="flex gap-2">
              <Input value={form.div} onChange={(e) => setField('div', e.target.value)} placeholder="Enter division" />
              <Button type="button" variant="outline" size="sm" onClick={() => { setCustomDiv(false); setField('div', ''); }}>List</Button>
            </div>
          ) : (
            <Select value={form.div} onValueChange={(v) => { if (v === '__custom__') { setCustomDiv(true); setField('div', ''); } else setField('div', v); }}>
              <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                <SelectItem value="__custom__">Custom...</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Day *</Label>
        <Select value={form.day} onValueChange={(v) => setField('day', v)} required>
          <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
          <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <TimingPicker timing={form.timing} onChange={(v) => setField('timing', v)} />
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-2"><Label>No. of Sessions *</Label><Input type="number" value={form.num_sessions} onChange={(e) => setField('num_sessions', parseInt(e.target.value) || 0)} required /></div>
      </div>
      <div className="space-y-2"><Label>Instructors Name *</Label><Input value={form.instructor_names} onChange={(e) => setField('instructor_names', e.target.value)} placeholder="e.g. Mr. Smith, Ms. Jones" required /></div>
      <div className="space-y-2"><Label>Class Venue *</Label><Input value={form.venue} onChange={(e) => setField('venue', e.target.value)} placeholder="e.g. Room 201" required /></div>
    </div>
  );

  if (selectedClassId && selectedClass) {
    return (
      <DashboardLayout>
        <div className="page-header flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedClassId(null); setStudents([]); }}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="page-title flex items-center gap-2"><BookOpen className="w-5 h-5 text-accent" />{getClassName(selectedClass)}</h1>
            <p className="page-subtitle">{selectedClass.schools?.name ?? 'Unknown School'}</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">Class Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground block">School</span><span className="font-medium">{selectedClass.schools?.name ?? '—'}</span></div>
              <div><span className="text-muted-foreground block">Grade</span><span className="font-medium">{selectedClass.grade || '—'}</span></div>
              <div><span className="text-muted-foreground block">Division</span><span className="font-medium">{selectedClass.div || '—'}</span></div>
              <div><span className="text-muted-foreground block">Day</span><span className="font-medium">{selectedClass.day || '—'}</span></div>
              <div><span className="text-muted-foreground block">Timing</span><span className="font-medium">{selectedClass.timing || '—'}</span></div>
              <div><span className="text-muted-foreground block">No. of Sessions</span><span className="font-medium">{selectedClass.num_sessions ?? 0}</span></div>
              <div><span className="text-muted-foreground block">Sessions Conducted</span><span className="font-medium">{sessionCounts[selectedClass.id] || 0}</span></div>
              <div><span className="text-muted-foreground block">Instructor(s)</span><span className="font-medium">{selectedClass.instructor_names || '—'}</span></div>
              <div><span className="text-muted-foreground block">Venue</span><span className="font-medium">{selectedClass.venue || '—'}</span></div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-heading font-semibold mb-4">Students</h2>
        {studentsLoading ? <div className="text-center py-20 text-muted-foreground">Loading students...</div> : students.length === 0 ? (
          <div className="text-center py-20"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No students in this class yet.</p></div>
        ) : (
          <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="w-16">#</TableHead><TableHead>Roll No</TableHead><TableHead>Student Name</TableHead><TableHead>Grade</TableHead><TableHead>Div</TableHead><TableHead>Parent Mobile 1</TableHead><TableHead>Parent Email 1</TableHead></TableRow></TableHeader>
            <TableBody>{students.map((s, i) => (<TableRow key={s.id}><TableCell className="text-muted-foreground">{i + 1}</TableCell><TableCell className="font-medium">{s.roll_number ?? '—'}</TableCell><TableCell>{s.full_name}</TableCell><TableCell>{s.grade ?? '—'}</TableCell><TableCell>{s.div ?? '—'}</TableCell><TableCell>{s.parent_mobile_1 ?? '—'}</TableCell><TableCell>{s.parent_email_1 ?? '—'}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Classes</h1><p className="page-subtitle">Manage classes across schools</p></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('grid')}><LayoutGrid className="w-4 h-4" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('list')}><List className="w-4 h-4" /></Button>
          </div>
          <ExportDropdown onExportExcel={handleExport} onExportPdf={handleExportPdf} />
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Delete ({selected.size})</Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openAddDialog}><Plus className="w-4 h-4 mr-2" /> Add Class</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editId ? 'Edit Class' : 'Add New Class'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit}>{classFormFields}<Button type="submit" className="w-full mt-4" disabled={loading || !form.school_id}>{loading ? 'Saving...' : editId ? 'Update Class' : 'Add Class'}</Button></form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={filterSchool} onValueChange={setFilterSchool}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filterSchool === 'all' ? (
        <div className="text-center py-20"><School className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Please select a school to view its classes.</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20"><BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{search ? 'No classes match your search.' : 'No classes in this school yet.'}</p></div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /><span className="text-sm text-muted-foreground">Select all</span></div>
          
          {viewMode === 'grid' ? (
            <div className="space-y-8">
              {grouped.map(({ schoolName, classes: groupClasses }) => (
                <div key={schoolName}>
                  <div className="flex items-center gap-2 mb-4"><School className="w-4.5 h-4.5 text-primary" /><h2 className="text-lg font-heading font-semibold text-foreground">{schoolName}</h2><span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{groupClasses.length}</span></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupClasses.map((cls: any) => (
                      <Card key={cls.id} className="animate-fade-in hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40 relative" onClick={() => handleSelectClass(cls.id)}>
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(cls)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Checkbox checked={selected.has(cls.id)} onCheckedChange={() => toggleSelect(cls.id)} />
                        </div>
                        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />{getClassName(cls)}</CardTitle></CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{cls.schools?.name ?? 'Unknown School'}</p>
                          {(cls.grade || cls.div) && <p className="text-xs text-muted-foreground mt-0.5">Grade: {cls.grade || '—'} • Div: {cls.div || '—'}</p>}
                          {cls.day && <p className="text-xs text-muted-foreground mt-0.5">{cls.day} {cls.timing ? `• ${cls.timing}` : ''}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Sessions conducted: <span className="font-semibold text-foreground">{sessionCounts[cls.id] || 0}</span>{cls.num_sessions ? ` / ${cls.num_sessions}` : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Class Name</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Div</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Timing</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cls) => (
                    <TableRow key={cls.id} className="cursor-pointer" onClick={() => handleSelectClass(cls.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(cls.id)} onCheckedChange={() => toggleSelect(cls.id)} /></TableCell>
                      <TableCell className="font-medium"><div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />{getClassName(cls)}</div></TableCell>
                      <TableCell className="text-muted-foreground">{cls.schools?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{cls.grade || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{cls.div || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{cls.day || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{cls.timing || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{sessionCounts[cls.id] || 0}{cls.num_sessions ? ` / ${cls.num_sessions}` : ''}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(cls)}><Pencil className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selected.size} class(es)?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the selected classes and all associated data.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Classes;
