import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Pencil, CalendarDays, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const getClassName = (c: any) => [c.name, c.grade, c.div].filter(Boolean).join(' - ');

// Deterministic soft color per school (row tint)
const SCHOOL_COLORS = [
  '#EFF6FF', '#ECFDF5', '#FEF3C7', '#FDF2F8', '#F5F3FF', '#ECFEFF', '#FEF2F2', '#F0FDF4',
];
const tintFor = (id: string) => {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SCHOOL_COLORS[h % SCHOOL_COLORS.length];
};

const AdminSchedule = () => {
  const { role, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ day: '', timing: '', instructor_names: '', venue: '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const [classesRes, studentsRes, topicsRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, grade, div, day, timing, instructor_names, venue, school_id, schools(id, name, transport_mode)'),
      supabase.from('students').select('id, class_id, laptop_no'),
      supabase.from('topics').select('class_id, topic').eq('date', today),
    ]);

    if (classesRes.error) { toast.error(classesRes.error.message); setLoading(false); return; }

    const studentsByClass = new Map<string, any[]>();
    (studentsRes.data ?? []).forEach((s: any) => {
      if (!studentsByClass.has(s.class_id)) studentsByClass.set(s.class_id, []);
      studentsByClass.get(s.class_id)!.push(s);
    });

    const topicByClass = new Map<string, string>();
    (topicsRes.data ?? []).forEach((t: any) => topicByClass.set(t.class_id, t.topic));

    const merged = (classesRes.data ?? []).map((c: any) => {
      const students = studentsByClass.get(c.id) ?? [];
      const laptops = students.map(s => s.laptop_no).filter(Boolean).sort();
      return {
        ...c,
        students_count: students.length,
        laptop_nos: laptops.join(', '),
        topic: topicByClass.get(c.id) ?? '',
      };
    });

    merged.sort((a, b) => {
      const s = (a.schools?.name ?? '').localeCompare(b.schools?.name ?? '');
      if (s !== 0) return s;
      return getClassName(a).localeCompare(getClassName(b));
    });

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { if (role === 'admin') load(); }, [role]);

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ day: c.day ?? '', timing: c.timing ?? '', instructor_names: c.instructor_names ?? '', venue: c.venue ?? '' });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from('classes').update(form).eq('id', editing.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Schedule updated');
      logActivity({ action: 'updated', section: 'classes', description: `Updated schedule for "${getClassName(editing)}"` });
      setEditing(null);
      load();
    }
    setSaving(false);
  };

  const exportPng = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(tableRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.download = `Schedule_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
      toast.success('Schedule exported');
    } catch (e: any) {
      toast.error(e.message || 'Failed to export');
    } finally { setExporting(false); }
  };

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><CalendarDays className="w-6 h-6" /> Instructor Schedule</h1>
          <p className="page-subtitle">All classes, grouped by school (A → Z). Click a row to edit. Export as PNG for sharing.</p>
        </div>
        <Button onClick={exportPng} disabled={exporting || loading}>
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export PNG
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading schedule…</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div ref={tableRef} className="p-6 bg-white min-w-[1100px]">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-slate-800">Weekly Class Schedule</h2>
                <span className="text-xs text-slate-500">Generated {format(new Date(), 'dd MMM yyyy')} · {rows.length} classes</span>
              </div>
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: '#1E293B', color: '#fff' }}>
                    {['School Name', 'Class Name', 'Day', 'Timing', 'Students', 'Laptop Nos.', 'Topic of the Day', 'Instructor', 'Transport Mode', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-semibold border border-slate-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-400">No classes found.</td></tr>
                  )}
                  {rows.map(r => (
                    <tr key={r.id} style={{ background: tintFor(r.school_id) }} className="align-top">
                      <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">{r.schools?.name ?? '—'}</td>
                      <td className="px-3 py-2 border border-slate-200 font-medium text-slate-700">{getClassName(r)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-700">{r.day || '—'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-700 whitespace-nowrap">{r.timing || '—'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-700">{r.students_count}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-700 max-w-[180px]">{r.laptop_nos || '—'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-700 max-w-[220px]">{r.topic || <span className="italic text-slate-400">Not set</span>}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-700">{r.instructor_names || <span className="italic text-slate-400">—</span>}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-700">{r.schools?.transport_mode || <span className="italic text-slate-400">—</span>}</td>
                      <td className="px-2 py-2 border border-slate-200 text-center">
                        <button onClick={() => openEdit(r)} className="text-slate-500 hover:text-primary" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class — {editing && getClassName(editing)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={form.day} onValueChange={v => setForm(f => ({ ...f, day: v }))}>
                <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timing</Label>
              <Input value={form.timing} onChange={e => setForm(f => ({ ...f, timing: e.target.value }))} placeholder="e.g. 9:00 AM - 10:00 AM" />
            </div>
            <div className="space-y-2">
              <Label>Instructor(s) — comma separated</Label>
              <Input value={form.instructor_names} onChange={e => setForm(f => ({ ...f, instructor_names: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminSchedule;
