import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllAttendanceSessions, fetchAllPaginated } from '@/lib/fetchAllAttendance';
import { capitalizeFields } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import SearchFilterBar from '@/components/SearchFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, School, BookOpen, Users, ArrowLeft, Trash2, Pencil, LayoutGrid, List, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportSchoolsAsZip } from '@/lib/exportSchoolsZip';
import { getSchoolColor } from '@/lib/colorCoding';
import { exportToPdf } from '@/lib/exportPdf';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface SchoolForm {
  name: string;
  address: string;
  days: string[];
  ir_coordinator_name: string;
  ir_coordinator_mobile: string;
  primary_coordinator_name: string;
  primary_coordinator_mobile: string;
  secondary_coordinator_name: string;
  secondary_coordinator_mobile: string;
}

const emptyForm: SchoolForm = {
  name: '', address: '', days: [],
  ir_coordinator_name: '', ir_coordinator_mobile: '',
  primary_coordinator_name: '', primary_coordinator_mobile: '',
  secondary_coordinator_name: '', secondary_coordinator_mobile: '',
};

const Schools = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [classSessionsConducted, setClassSessionsConducted] = useState<Record<string, number>>({});

  const [schoolStats, setSchoolStats] = useState<Record<string, { classes: number; students: number; sessionsConducted: number; totalSessions: number }>>({});

  const fetchSchools = async () => {
    const [schoolsData, classesData, studentsData, attendanceData] = await Promise.all([
      fetchAllPaginated<any>(() => supabase.from('schools').select('*').order('created_at', { ascending: false })),
      fetchAllPaginated<{ id: string; school_id: string; num_sessions: number | null }>(() => supabase.from('classes').select('id, school_id, num_sessions')),
      fetchAllPaginated<{ id: string; class_id: string }>(() => supabase.from('students').select('id, class_id')),
      fetchAllAttendanceSessions(),
    ]);
    setSchools(schoolsData);

    // Build class_id -> school_id map
    const classSchoolMap: Record<string, string> = {};
    classesData.forEach((c) => { classSchoolMap[c.id] = c.school_id; });

    // Count unique date|topic combinations per class for sessions conducted
    const classSessionsConducted: Record<string, Set<string>> = {};
    attendanceData.forEach((a: any) => {
      if (!classSessionsConducted[a.class_id]) classSessionsConducted[a.class_id] = new Set();
      classSessionsConducted[a.class_id].add(`${a.date}|${a.topic || ''}`);
    });

    const stats: Record<string, { classes: number; students: number; sessionsConducted: number; totalSessions: number }> = {};
    schoolsData.forEach((s) => { stats[s.id] = { classes: 0, students: 0, sessionsConducted: 0, totalSessions: 0 }; });
    classesData.forEach((c) => {
      if (stats[c.school_id]) {
        stats[c.school_id].classes++;
        stats[c.school_id].sessionsConducted += classSessionsConducted[c.id]?.size ?? 0;
        stats[c.school_id].totalSessions += c.num_sessions ?? 0;
      }
    });
    studentsData.forEach((s) => { const schoolId = classSchoolMap[s.class_id]; if (schoolId && stats[schoolId]) stats[schoolId].students++; });
    setSchoolStats(stats);
  };

  useEffect(() => { fetchSchools(); }, []);

  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});

  const fetchClasses = useCallback(async (schoolId: string) => {
    setClassesLoading(true);
    const [classesData, attendanceRows, studentsData] = await Promise.all([
      fetchAllPaginated<any>(() => supabase.from('classes').select('*').eq('school_id', schoolId).order('name', { ascending: true })),
      fetchAllAttendanceSessions(),
      fetchAllPaginated<{ id: string; class_id: string }>(() => supabase.from('students').select('id, class_id')),
    ]);
    setClasses(classesData);
    
    const conducted: Record<string, Set<string>> = {};
    attendanceRows.forEach((a: any) => {
      if (!conducted[a.class_id]) conducted[a.class_id] = new Set();
      conducted[a.class_id].add(`${a.date}|${a.topic || ''}`);
    });
    const conductedCounts: Record<string, number> = {};
    Object.entries(conducted).forEach(([id, sessions]) => { conductedCounts[id] = sessions.size; });
    setClassSessionsConducted(conductedCounts);
    const sCounts: Record<string, number> = {};
    studentsData.forEach((s) => { sCounts[s.class_id] = (sCounts[s.class_id] || 0) + 1; });
    setClassStudentCounts(sCounts);
    setClassesLoading(false);
  }, []);

  const handleSelectSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    fetchClasses(schoolId);
  };

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  const filtered = useMemo(() => {
    let result = schools.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.address ?? '').toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'name-asc') result.sort((a: any, b: any) => a.name.localeCompare(b.name));
    else if (sort === 'name-desc') result.sort((a: any, b: any) => b.name.localeCompare(a.name));
    else if (sort === 'oldest') result.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    return result;
  }, [schools, search, sort]);

  const setField = (key: keyof SchoolForm, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  const openAddDialog = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEditDialog = (school: any) => {
    setEditId(school.id);
    setForm({
      name: school.name, address: school.address ?? '', days: school.days ?? [],
      ir_coordinator_name: school.ir_coordinator_name ?? '', ir_coordinator_mobile: school.ir_coordinator_mobile ?? '',
      primary_coordinator_name: school.primary_coordinator_name ?? '', primary_coordinator_mobile: school.primary_coordinator_mobile ?? '',
      secondary_coordinator_name: school.secondary_coordinator_name ?? '', secondary_coordinator_mobile: school.secondary_coordinator_mobile ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.days.length === 0) { toast.error('Please select at least one day'); return; }
    if (!form.ir_coordinator_name.trim()) { toast.error('IR Coordinator Name is required'); return; }
    
    setLoading(true);
    const payload = capitalizeFields({ ...form }, ['name', 'address', 'ir_coordinator_name', 'primary_coordinator_name', 'secondary_coordinator_name']);
    if (editId) {
      const { error } = await supabase.from('schools').update(payload).eq('id', editId);
      if (error) toast.error(error.message);
      else { toast.success('School updated!'); setOpen(false); fetchSchools(); logActivity({ action: 'updated', section: 'schools', description: `Updated school "${payload.name}"` }); }
    } else {
      const { error } = await supabase.from('schools').insert({ ...payload, created_by: user.id });
      if (error) toast.error(error.message);
      else { toast.success('School added!'); setOpen(false); fetchSchools(); logActivity({ action: 'created', section: 'schools', description: `Created school "${payload.name}"` }); }
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map((s) => s.id)));

  const handleDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('schools').delete().in('id', ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} school(s) deleted`); setSelected(new Set()); fetchSchools(); logActivity({ action: 'deleted', section: 'schools', description: `Deleted ${ids.length} school(s)` }); }
    setDeleting(false);
    setDeleteOpen(false);
  };

  const handleExport = async (scope: 'selected' | 'all') => {
    const ids = scope === 'selected' ? Array.from(selected) : filtered.map((s) => s.id);
    if (ids.length === 0) { toast.error(scope === 'selected' ? 'No schools selected' : 'No schools to export'); return; }
    toast.info('Preparing export...');
    try {
      await exportSchoolsAsZip(ids);
      toast.success('Export downloaded!');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const handleExportPdf = async (scope: 'selected' | 'all') => {
    const schoolsToExport = scope === 'selected' ? filtered.filter(s => selected.has(s.id)) : filtered;
    if (schoolsToExport.length === 0) { toast.error(scope === 'selected' ? 'No schools selected' : 'No schools to export'); return; }
    toast.info('Preparing PDF export...');
    try {
      const ids = schoolsToExport.map(s => s.id);
      const [classesRes, allStudentsData, allAttendanceData] = await Promise.all([
        supabase.from('classes').select('*').in('school_id', ids),
        fetchAllPaginated<any>(() => supabase.from('students').select('*')),
        fetchAllPaginated<any>(() => supabase.from('attendance').select('*')),
      ]);
      const allClassesData = classesRes.data ?? [];

      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      let htmlContent = '';
      for (const school of schoolsToExport) {
        const schoolClasses = allClassesData.filter(c => c.school_id === school.id);
        
        htmlContent += `<div style="page-break-before:${htmlContent ? 'always' : 'auto'};">`;
        htmlContent += `<h1 style="font-size:18px;margin-bottom:8px;">${school.name}</h1>`;
        htmlContent += `<table style="border-collapse:collapse;width:100%;margin-bottom:20px;">`;
        htmlContent += `<tr><td style="border:1px solid #ccc;padding:5px 8px;font-weight:bold;background:#FFD966;">Address</td><td style="border:1px solid #ccc;padding:5px 8px;">${school.address || '—'}</td></tr>`;
        htmlContent += `<tr><td style="border:1px solid #ccc;padding:5px 8px;font-weight:bold;background:#FFD966;">Days</td><td style="border:1px solid #ccc;padding:5px 8px;">${(school.days ?? []).join(', ') || '—'}</td></tr>`;
        htmlContent += `<tr><td style="border:1px solid #ccc;padding:5px 8px;font-weight:bold;background:#FFD966;">IR Coordinator</td><td style="border:1px solid #ccc;padding:5px 8px;">${school.ir_coordinator_name || '—'} ${school.ir_coordinator_mobile ? `(${school.ir_coordinator_mobile})` : ''}</td></tr>`;
        htmlContent += `<tr><td style="border:1px solid #ccc;padding:5px 8px;font-weight:bold;background:#FFD966;">Primary Coordinator</td><td style="border:1px solid #ccc;padding:5px 8px;">${school.primary_coordinator_name || '—'} ${school.primary_coordinator_mobile ? `(${school.primary_coordinator_mobile})` : ''}</td></tr>`;
        htmlContent += `<tr><td style="border:1px solid #ccc;padding:5px 8px;font-weight:bold;background:#FFD966;">Secondary Coordinator</td><td style="border:1px solid #ccc;padding:5px 8px;">${school.secondary_coordinator_name || '—'} ${school.secondary_coordinator_mobile ? `(${school.secondary_coordinator_mobile})` : ''}</td></tr>`;
        htmlContent += `</table>`;

        for (const cls of schoolClasses) {
          const classStudents = allStudentsData.filter(s => s.class_id === cls.id);
          const classAttendance = allAttendanceData.filter(a => a.class_id === cls.id);
          // Build composite session keys for multi-session per day support
          const sessionKeySet = new Set<string>();
          classAttendance.forEach(a => sessionKeySet.add(`${a.date}|${a.topic || ''}`));
          const sessionKeys = [...sessionKeySet].sort();

          const statusMap: Record<string, Record<string, string>> = {};
          classAttendance.forEach(a => {
            const key = `${a.date}|${a.topic || ''}`;
            if (!statusMap[a.student_id]) statusMap[a.student_id] = {};
            statusMap[a.student_id][key] = a.status;
          });

          const sheetLabel = [cls.name, cls.grade, cls.div].filter(Boolean).join(' - ');
          htmlContent += `<h2 style="font-size:14px;margin:16px 0 6px;">${sheetLabel}</h2>`;
          htmlContent += `<p style="font-size:11px;color:#666;margin-bottom:6px;">Day: ${cls.day || '—'} | Timing: ${cls.timing || '—'} | Instructor(s): ${cls.instructor_names || '—'} | Venue: ${cls.venue || '—'}</p>`;
          
          htmlContent += `<table style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:9px;">`;
          htmlContent += `<tr><th style="border:1px solid #333;padding:4px;background:#FFD966;font-weight:bold;text-align:left;">Student</th><th style="border:1px solid #333;padding:4px;background:#FFD966;">Grade</th><th style="border:1px solid #333;padding:4px;background:#FFD966;">Div</th><th style="border:1px solid #333;padding:4px;background:#FFD966;">Total</th>`;
          for (const k of sessionKeys) {
            const d = k.split('|')[0];
            const topic = k.split('|')[1] || '';
            const parsed = new Date(d + 'T00:00:00');
            htmlContent += `<th style="border:1px solid #333;padding:4px;background:#FFD966;font-size:8px;">${parsed.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}<br/>${DAY_NAMES[parsed.getDay()].slice(0,3)}<br/><span style="font-weight:normal;font-size:7px;">${topic}</span></th>`;
          }
          htmlContent += `</tr>`;
          
          for (const s of classStudents) {
            const statuses = sessionKeys.map(k => {
              const st = statusMap[s.id]?.[k] ?? '';
              if (st === 'present') return 'P';
              if (st === 'absent') return 'A';
              if (st === 'kit') return 'K';
              if (st === 'quiz') return 'Q';
              if (st === 'left') return 'L';
              return '';
            });
            const attended = statuses.filter(x => x === 'P' || x === 'K' || x === 'Q').length;
            htmlContent += `<tr><td style="border:1px solid #ccc;padding:3px 5px;">${s.full_name}</td><td style="border:1px solid #ccc;padding:3px;text-align:center;">${s.grade ?? ''}</td><td style="border:1px solid #ccc;padding:3px;text-align:center;">${s.div ?? ''}</td><td style="border:1px solid #ccc;padding:3px;text-align:center;font-weight:bold;">${attended}/${sessionKeys.length}</td>`;
            for (const st of statuses) {
              let bg = '';
              if (st === 'P') bg = 'background:#C6EFCE;color:#006100;font-weight:bold;text-align:center;';
              else if (st === 'A') bg = 'background:#FFC7CE;color:#9C0006;font-weight:bold;text-align:center;';
              else if (st === 'L') bg = 'background:#8B0000;color:#FFFFFF;font-weight:bold;text-align:center;';
              else if (st === 'K' || st === 'Q') bg = 'background:#BDD7EE;color:#1F4E79;font-weight:bold;text-align:center;';
              htmlContent += `<td style="border:1px solid #ccc;padding:3px;${bg}">${st}</td>`;
            }
            htmlContent += `</tr>`;
          }
          htmlContent += `</table>`;
        }
        htmlContent += `</div>`;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) { toast.error('Pop-up blocked'); return; }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Schools Report</title>
<style>body{font-family:Arial,sans-serif;margin:15px;}@media print{body{margin:8px;}}</style></head><body>${htmlContent}
<script>window.onload=function(){window.print();}</script></body></html>`);
      printWindow.document.close();
    } catch (err: any) {
      toast.error(err.message || 'PDF export failed');
    }
  };

  const schoolFormFields = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>School Name *</Label>
        <Input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Springfield Academy" required />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="e.g. 123 Main St" />
      </div>
      <div className="space-y-2">
        <Label>Days *</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <Button key={day} type="button" size="sm" variant={form.days.includes(day) ? 'default' : 'outline'} onClick={() => toggleDay(day)}>
              {day.slice(0, 3)}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>IR Coordinator Name *</Label><Input value={form.ir_coordinator_name} onChange={(e) => setField('ir_coordinator_name', e.target.value)} required /></div>
        <div className="space-y-2"><Label>IR Coordinator Mobile No.</Label><Input value={form.ir_coordinator_mobile} onChange={(e) => setField('ir_coordinator_mobile', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Primary Coordinator Name</Label><Input value={form.primary_coordinator_name} onChange={(e) => setField('primary_coordinator_name', e.target.value)} /></div>
        <div className="space-y-2"><Label>Primary Coordinator Mobile</Label><Input value={form.primary_coordinator_mobile} onChange={(e) => setField('primary_coordinator_mobile', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Secondary Coordinator Name</Label><Input value={form.secondary_coordinator_name} onChange={(e) => setField('secondary_coordinator_name', e.target.value)} /></div>
        <div className="space-y-2"><Label>Secondary Coordinator Mobile</Label><Input value={form.secondary_coordinator_mobile} onChange={(e) => setField('secondary_coordinator_mobile', e.target.value)} /></div>
      </div>
    </div>
  );

  if (selectedSchoolId && selectedSchool) {
    return (
      <DashboardLayout>
        <div className="page-header flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedSchoolId(null); setClasses([]); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="page-title flex items-center gap-2"><School className="w-5 h-5 text-primary" />{selectedSchool.name}</h1>
            <p className="page-subtitle">{selectedSchool.address ?? 'No address'}</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">School Details</CardTitle></CardHeader>
          <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
               <div><span className="text-muted-foreground block">Address</span><span className="font-medium">{selectedSchool.address || '—'}</span></div>
               <div><span className="text-muted-foreground block">Days</span><span className="font-medium">{(selectedSchool.days ?? []).length > 0 ? (selectedSchool.days as string[]).join(', ') : '—'}</span></div>
               <div><span className="text-muted-foreground block">Total Classes</span><span className="font-medium">{schoolStats[selectedSchool.id]?.classes ?? 0}</span></div>
               <div><span className="text-muted-foreground block">Total Students</span><span className="font-medium">{schoolStats[selectedSchool.id]?.students ?? 0}</span></div>
               <div><span className="text-muted-foreground block">Sessions Conducted</span><span className="font-medium">{schoolStats[selectedSchool.id]?.sessionsConducted ?? 0} / {schoolStats[selectedSchool.id]?.totalSessions ?? 0}</span></div>
               <div><span className="text-muted-foreground block">IR Coordinator</span><span className="font-medium">{selectedSchool.ir_coordinator_name || '—'}</span>{selectedSchool.ir_coordinator_mobile && <span className="text-xs text-muted-foreground block">{selectedSchool.ir_coordinator_mobile}</span>}</div>
               <div><span className="text-muted-foreground block">Primary Coordinator</span><span className="font-medium">{selectedSchool.primary_coordinator_name || '—'}</span>{selectedSchool.primary_coordinator_mobile && <span className="text-xs text-muted-foreground block">{selectedSchool.primary_coordinator_mobile}</span>}</div>
               <div><span className="text-muted-foreground block">Secondary Coordinator</span><span className="font-medium">{selectedSchool.secondary_coordinator_name || '—'}</span>{selectedSchool.secondary_coordinator_mobile && <span className="text-xs text-muted-foreground block">{selectedSchool.secondary_coordinator_mobile}</span>}</div>
             </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-heading font-semibold mb-4">Classes</h2>
        {classesLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading classes...</div>
        ) : classes.length === 0 ? (
          <div className="text-center py-20"><BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No classes in this school yet.</p></div>
        ) : (
          <Card><CardContent className="p-0">
             <Table><TableHeader><TableRow><TableHead className="w-16">#</TableHead><TableHead>Class Name</TableHead><TableHead>Day</TableHead><TableHead>Timing</TableHead><TableHead>Instructor(s)</TableHead><TableHead>Venue</TableHead><TableHead>Students</TableHead><TableHead>Sessions Conducted</TableHead></TableRow></TableHeader>
               <TableBody>{classes.map((cls, i) => (
                 <TableRow key={cls.id}>
                   <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                   <TableCell className="font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />{cls.name}</TableCell>
                   <TableCell>{cls.day || '—'}</TableCell>
                   <TableCell>{cls.timing || '—'}</TableCell>
                   <TableCell>{cls.instructor_names || '—'}</TableCell>
                   <TableCell>{cls.venue || '—'}</TableCell>
                   <TableCell>{classStudentCounts[cls.id] ?? 0}</TableCell>
                   <TableCell>{classSessionsConducted[cls.id] ?? 0} / {cls.num_sessions ?? 0}</TableCell>
                 </TableRow>
               ))}</TableBody></Table>
          </CardContent></Card>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div><h1 className="page-title">Schools</h1><p className="page-subtitle">Manage your institutes</p></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('grid')}><LayoutGrid className="w-4 h-4" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('list')}><List className="w-4 h-4" /></Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {selected.size > 0 && (
                <>
                  <DropdownMenuItem onClick={() => handleExport('selected')}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />Selected as Excel ({selected.size})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPdf('selected')}>
                    <FileText className="w-4 h-4 mr-2" />Selected as PDF ({selected.size})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => handleExport('all')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />All Schools as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPdf('all')}>
                <FileText className="w-4 h-4 mr-2" />All Schools as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Delete ({selected.size})</Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openAddDialog}><Plus className="w-4 h-4 mr-2" /> Add School</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editId ? 'Edit School' : 'Add New School'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit}>
                {schoolFormFields}
                <Button type="submit" className="w-full mt-4" disabled={loading}>{loading ? 'Saving...' : editId ? 'Update School' : 'Add School'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search schools..."
        sortOptions={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name-asc', label: 'Name A-Z' }, { value: 'name-desc', label: 'Name Z-A' }]}
        sortValue={sort} onSortChange={setSort} />

      {filtered.length === 0 ? (
        <div className="text-center py-20"><School className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{search ? 'No schools match your search.' : 'No schools yet. Add your first school to get started.'}</p></div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /><span className="text-sm text-muted-foreground">Select all</span></div>
          
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((school) => (
                <Card key={school.id} className={cn("animate-fade-in hover:shadow-md transition-shadow cursor-pointer relative border-l-4", getSchoolColor(school.name).border)} onClick={() => handleSelectSchool(school.id)}>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(school)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Checkbox checked={selected.has(school.id)} onCheckedChange={() => toggleSelect(school.id)} />
                  </div>
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><div className={cn("w-2.5 h-2.5 rounded-full", getSchoolColor(school.name).dot)} /><School className="w-4 h-4 text-primary" />{school.name}</CardTitle></CardHeader>
                   <CardContent>
                     <div className="flex items-center gap-3 text-sm text-muted-foreground">
                       <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{schoolStats[school.id]?.classes ?? 0} classes</span>
                       <span className="flex items-center gap-1"><Users className="w-3 h-3" />{schoolStats[school.id]?.students ?? 0} students</span>
                     </div>
                     {(school.days ?? []).length > 0 && <p className="text-xs text-muted-foreground mt-1">{(school.days as string[]).map((d: string) => d.slice(0, 3)).join(', ')}</p>}
                   </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                     <TableHead>Classes</TableHead>
                     <TableHead>Students</TableHead>
                     <TableHead>Days</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((school) => (
                    <TableRow key={school.id} className="cursor-pointer" onClick={() => handleSelectSchool(school.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(school.id)} onCheckedChange={() => toggleSelect(school.id)} /></TableCell>
                      <TableCell className="font-medium"><div className="flex items-center gap-2"><div className={cn("w-2.5 h-2.5 rounded-full shrink-0", getSchoolColor(school.name).dot)} /><School className="w-4 h-4 text-primary" />{school.name}</div></TableCell>
                       <TableCell className="text-muted-foreground">{schoolStats[school.id]?.classes ?? 0}</TableCell>
                       <TableCell className="text-muted-foreground">{schoolStats[school.id]?.students ?? 0}</TableCell>
                       <TableCell className="text-muted-foreground">{(school.days ?? []).length > 0 ? (school.days as string[]).map((d: string) => d.slice(0, 3)).join(', ') : '—'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(school)}><Pencil className="w-3.5 h-3.5" /></Button>
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
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selected.size} school(s)?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the selected schools and all associated data.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Schools;
