import { useEffect, useState, useMemo, useRef } from 'react';
import XLSX from 'xlsx-js-style';
import { capitalizeFields } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Users, Trash2, Pencil, Upload, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';
import ExportDropdown from '@/components/ExportDropdown';

interface StudentForm {
  full_name: string;
  class_id: string;
  grade: string;
  div: string;
  parent_email_1: string;
  parent_email_2: string;
  parent_mobile_1: string;
  parent_mobile_2: string;
}

const emptyForm: StudentForm = {
  full_name: '', class_id: '', grade: '', div: '',
  parent_email_1: '', parent_email_2: '', parent_mobile_1: '', parent_mobile_2: '',
};

const PAGE_SIZE = 20;

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const Students = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterGrade, setFilterGrade] = useState('');
  const [filterDiv, setFilterDiv] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<any[] | null>(null);
  const [importClassId, setImportClassId] = useState('');
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [formSchool, setFormSchool] = useState('');
  const [importSchool, setImportSchool] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMeta = async () => {
    const [classesRes, schoolsRes] = await Promise.all([
      supabase.from('classes').select('id, name, school_id, day, grade, div, schools(name)'),
      supabase.from('schools').select('id, name'),
    ]);
    setClasses(classesRes.data ?? []);
    setSchools(schoolsRes.data ?? []);
  };

  const fetchStudents = async (classId: string) => {
    const data = await fetchAllPaginated<any>(() =>
      supabase.from('students').select('*, classes(name, schools(name))').eq('class_id', classId).order('full_name'),
    );
    setStudents(data);
  };

  useEffect(() => { fetchMeta(); }, []);

  useEffect(() => {
    if (filterClass) fetchStudents(filterClass);
    else setStudents([]);
  }, [filterClass]);

  const filteredClasses = useMemo(() => {
    if (!filterSchool) return [];
    return classes.filter(c => c.school_id === filterSchool);
  }, [classes, filterSchool]);

  // Removed grade/div filters - now part of class name selection

  const availableDays = useMemo(() => {
    if (!filterSchool) return [];
    const days = new Set(classes.filter(c => c.school_id === filterSchool).map(c => c.day).filter(Boolean));
    return Array.from(days).sort();
  }, [classes, filterSchool]);

  const formFilteredClasses = useMemo(() => {
    if (!formSchool) return [];
    return classes.filter(c => c.school_id === formSchool);
  }, [classes, formSchool]);

  const importFilteredClasses = useMemo(() => {
    if (!importSchool) return [];
    return classes.filter(c => c.school_id === importSchool);
  }, [classes, importSchool]);

  const filtered = useMemo(() => {
    let result = students.filter((s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.grade ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.div ?? '').toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'name-asc') result.sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    else if (sort === 'name-desc') result.sort((a: any, b: any) => b.full_name.localeCompare(a.full_name));
    return result;
  }, [students, search, sort]);

  useEffect(() => { setPage(1); }, [search, sort, filterClass]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setField = (key: keyof StudentForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openAddDialog = () => { setEditId(null); setForm(emptyForm); setFormSchool(filterSchool); setOpen(true); };
  const openEditDialog = (s: any) => {
    setEditId(s.id);
    setFormSchool(classes.find(c => c.id === s.class_id)?.school_id || '');
    setForm({
      full_name: s.full_name, class_id: s.class_id,
      grade: s.grade ?? '', div: s.div ?? '',
      parent_email_1: s.parent_email_1 ?? '', parent_email_2: s.parent_email_2 ?? '',
      parent_mobile_1: s.parent_mobile_1 ?? '', parent_mobile_2: s.parent_mobile_2 ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = capitalizeFields({
      full_name: form.full_name, class_id: form.class_id,
      grade: form.grade || null, div: form.div || null,
      parent_email_1: form.parent_email_1 || null, parent_email_2: form.parent_email_2 || null,
      parent_mobile_1: form.parent_mobile_1 || null, parent_mobile_2: form.parent_mobile_2 || null,
    }, ['full_name']);
    if (editId) {
      const { error } = await supabase.from('students').update(payload).eq('id', editId);
      if (error) toast.error(error.message); else { toast.success('Student updated!'); setOpen(false); filterClass ? fetchStudents(filterClass) : undefined; logActivity({ action: 'updated', section: 'students', description: `Updated student "${payload.full_name}"` }); }
    } else {
      const { error } = await supabase.from('students').insert(payload);
      if (error) toast.error(error.message); else { toast.success('Student added!'); setOpen(false); filterClass ? fetchStudents(filterClass) : undefined; logActivity({ action: 'created', section: 'students', description: `Added student "${payload.full_name}"` }); }
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === paginated.length ? setSelected(new Set()) : setSelected(new Set(paginated.map((s) => s.id)));

  const handleDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('students').delete().in('id', ids);
    if (error) toast.error(error.message); else { toast.success(`${ids.length} student(s) deleted`); setSelected(new Set()); filterClass ? fetchStudents(filterClass) : undefined; logActivity({ action: 'deleted', section: 'students', description: `Deleted ${ids.length} student(s)` }); }
    setDeleting(false); setDeleteOpen(false);
  };

  const handleExport = () => {
    exportToExcel({ filename: 'students.xlsx', sheetName: 'Students', rows: filtered.map((s) => ({
      Name: s.full_name, Grade: s.grade ?? '', Div: s.div ?? '',
      Class: s.classes?.name ?? '', School: s.classes?.schools?.name ?? '',
      'Parent Email 1': s.parent_email_1 ?? '', 'Parent Email 2': s.parent_email_2 ?? '',
      'Parent Mobile 1': s.parent_mobile_1 ?? '', 'Parent Mobile 2': s.parent_mobile_2 ?? '',
    })) });
  };

  const handleExportPdf = () => {
    const headers = ['Name', 'Grade', 'Div', 'Class', 'School', 'Parent Email 1', 'Parent Mobile 1'];
    const rows = filtered.map(s => [
      s.full_name, s.grade ?? '—', s.div ?? '—',
      s.classes?.name ?? '—', s.classes?.schools?.name ?? '—',
      s.parent_email_1 ?? '—', s.parent_mobile_1 ?? '—',
    ]);
    exportToPdf({ title: 'Students Report', headers, rows, filename: 'students.pdf' });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Full Name', 'Grade', 'Div', 'Parent Email 1', 'Parent Email 2', 'Parent Mobile 1', 'Parent Mobile 2'],
      ['Jane Smith', '5', 'A', 'parent1@example.com', '', '9876543210', ''],
      ['John Doe', '5', 'B', 'parent2@example.com', 'parent2b@example.com', '9876543211', '9876543212'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 8 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students_import_template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws);
        if (json.length === 0) { toast.error('The file is empty'); return; }
        if (!('Full Name' in json[0])) { toast.error('Missing "Full Name" column. Please use the template.'); return; }
        setImportData(json);
      } catch {
        toast.error('Failed to parse the file');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!importData || !importClassId) return;
    setImporting(true);
    const rows = importData.map((row) => capitalizeFields({
      full_name: String(row['Full Name'] ?? '').trim(),
      grade: row['Grade'] ? String(row['Grade']).trim() : null,
      div: row['Div'] ? String(row['Div']).trim() : null,
      parent_email_1: row['Parent Email 1'] ? String(row['Parent Email 1']).trim() : null,
      parent_email_2: row['Parent Email 2'] ? String(row['Parent Email 2']).trim() : null,
      parent_mobile_1: row['Parent Mobile 1'] ? String(row['Parent Mobile 1']).trim() : null,
      parent_mobile_2: row['Parent Mobile 2'] ? String(row['Parent Mobile 2']).trim() : null,
      class_id: importClassId,
    }, ['full_name'])).filter((r) => r.full_name.length > 0);

    if (rows.length === 0) { toast.error('No valid student rows found'); setImporting(false); return; }

    const { error } = await supabase.from('students').insert(rows);
    if (error) { toast.error(error.message); }
    else { toast.success(`${rows.length} student(s) imported successfully!`); setImportOpen(false); setImportData(null); setImportClassId(''); filterClass ? fetchStudents(filterClass) : undefined; logActivity({ action: 'imported', section: 'students', description: `Imported ${rows.length} student(s)` }); }
    setImporting(false);
  };

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Students</h1><p className="page-subtitle">Manage student records</p></div>
        <div className="flex items-center gap-2">
          <ExportDropdown onExportExcel={handleExport} onExportPdf={handleExportPdf} />
          <Button variant="outline" size="sm" onClick={() => { setImportData(null); setImportClassId(''); setImportSchool(''); setImportOpen(true); }}>
            <Upload className="w-4 h-4 mr-2" />Import
          </Button>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Delete ({selected.size})</Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openAddDialog}><Plus className="w-4 h-4 mr-2" /> Add Student</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? 'Edit Student' : 'Add New Student'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} placeholder="e.g. Jane Smith" required /></div>
                  <div className="space-y-2">
                    <Label>School Name *</Label>
                    <Select value={formSchool} onValueChange={(v) => { setFormSchool(v); setField('class_id', ''); }}>
                      <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                      <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class Name *</Label>
                    <Select value={form.class_id} onValueChange={(v) => setField('class_id', v)} required disabled={!formSchool}>
                      <SelectTrigger><SelectValue placeholder={formSchool ? "Select class" : "Select school first"} /></SelectTrigger>
                      <SelectContent>{formFilteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Grade *</Label><Input value={form.grade} onChange={(e) => setField('grade', e.target.value)} placeholder="e.g. 5" required /></div>
                  <div className="space-y-2"><Label>Div *</Label><Input value={form.div} onChange={(e) => setField('div', e.target.value)} placeholder="e.g. A" required /></div>
                  <div className="space-y-2"><Label>Parent Email 1</Label><Input type="email" value={form.parent_email_1} onChange={(e) => setField('parent_email_1', e.target.value)} placeholder="parent1@example.com" /></div>
                  <div className="space-y-2"><Label>Parent Email 2</Label><Input type="email" value={form.parent_email_2} onChange={(e) => setField('parent_email_2', e.target.value)} placeholder="parent2@example.com" /></div>
                  <div className="space-y-2"><Label>Parent Mobile 1</Label><Input value={form.parent_mobile_1} onChange={(e) => setField('parent_mobile_1', e.target.value)} placeholder="e.g. 9876543210" /></div>
                  <div className="space-y-2"><Label>Parent Mobile 2</Label><Input value={form.parent_mobile_2} onChange={(e) => setField('parent_mobile_2', e.target.value)} placeholder="e.g. 9876543211" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || !form.class_id || !form.grade || !form.div}>{loading ? 'Saving...' : editId ? 'Update Student' : 'Add Student'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import Students from Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Download the sample template, fill in student details, then upload the file.</p>
              <p className="text-xs text-muted-foreground">Template columns: Full Name, Grade, Div, Parent Email 1, Parent Email 2, Parent Mobile 1, Parent Mobile 2</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="w-4 h-4 mr-2" />Download Template</Button>
            </div>

            <div className="space-y-2">
              <Label>School Name *</Label>
              <Select value={importSchool} onValueChange={(v) => { setImportSchool(v); setImportClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Select value={importClassId} onValueChange={setImportClassId} disabled={!importSchool}>
                <SelectTrigger><SelectValue placeholder={importSchool ? "Select class" : "Select school first"} /></SelectTrigger>
                <SelectContent>{importFilteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload Excel File *</Label>
              <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            </div>

            {importData && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{importData.length} student(s) found in file:</p>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Full Name</TableHead><TableHead>Grade</TableHead><TableHead>Div</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {importData.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-1 text-sm">{row['Full Name']}</TableCell>
                          <TableCell className="py-1 text-sm">{row['Grade'] ?? '-'}</TableCell>
                          <TableCell className="py-1 text-sm">{row['Div'] ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                      {importData.length > 50 && <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">...and {importData.length - 50} more</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Button className="w-full" disabled={!importData || !importClassId || importing} onClick={handleImport}>
              {importing ? 'Importing...' : `Import ${importData?.length ?? 0} Student(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters: School → Class Name → Day */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <Label>Filter by School</Label>
          <Select value={filterSchool} onValueChange={(v) => { setFilterSchool(v); setFilterClass(''); setFilterDay(''); setStudents([]); }}>
            <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
            <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Filter by Class Name</Label>
          <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setFilterDay(''); }} disabled={!filterSchool}>
            <SelectTrigger><SelectValue placeholder={filterSchool ? "Select a class" : "Select a school first"} /></SelectTrigger>
            <SelectContent>{filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Filter by Day</Label>
          <Select value={filterDay} onValueChange={setFilterDay} disabled={!filterSchool}>
            <SelectTrigger><SelectValue placeholder="All days" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              {availableDays.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!filterClass ? (
        <div className="text-center py-20"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Select a school and class to view students.</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{search ? 'No students match your search.' : 'No students in this class yet.'}</p></div>
      ) : (
        <>
          {/* Search within results */}
          <div className="mb-4">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, grade..." className="max-w-sm" />
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"><Checkbox checked={selected.size === paginated.length && paginated.length > 0} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Name</TableHead><TableHead>Grade</TableHead><TableHead>Div</TableHead>
                  <TableHead>Parent Email 1</TableHead><TableHead>Parent Mobile 1</TableHead>
                  <TableHead>Parent Email 2</TableHead><TableHead>Parent Mobile 2</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>{s.grade ?? '—'}</TableCell>
                    <TableCell>{s.div ?? '—'}</TableCell>
                    <TableCell>{s.parent_email_1 ?? '—'}</TableCell>
                    <TableCell>{s.parent_mobile_1 ?? '—'}</TableCell>
                    <TableCell>{s.parent_email_2 ?? '—'}</TableCell>
                    <TableCell>{s.parent_mobile_2 ?? '—'}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(s)}><Pencil className="w-3.5 h-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selected.size} student(s)?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the selected students and their attendance records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Students;
