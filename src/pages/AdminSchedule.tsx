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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Pencil, CalendarDays, Download, Loader2, GripVertical, Users, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getClassName = (c: any) => [c.name, c.grade, c.div].filter(Boolean).join(' - ');

const AdminSchedule = () => {
  const { role, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ timing: '', instructor_names: '', transport_mode: '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);
  const tableRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const [classesRes, studentsRes, topicsRes, profilesRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, grade, div, day, timing, instructor_names, venue, school_id, schools(id, name, transport_mode)'),
      supabase.from('students').select('id, class_id, laptop_no'),
      supabase.from('topics').select('class_id, topic').eq('date', today),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
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
    setInstructors((profilesRes.data ?? []).filter((p: any) => (p.full_name || '').trim()));
    setLoading(false);
  };

  useEffect(() => { if (role === 'admin') load(); }, [role]);

  const rowsByDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    DAYS.forEach(d => { m[d] = []; });
    rows.forEach(r => {
      if (r.day && m[r.day]) m[r.day].push(r);
    });
    return m;
  }, [rows]);

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      timing: c.timing ?? '',
      instructor_names: c.instructor_names ?? '',
      transport_mode: c.schools?.transport_mode ?? '',
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error: classErr } = await supabase
      .from('classes')
      .update({ timing: form.timing, instructor_names: form.instructor_names })
      .eq('id', editing.id);
    if (classErr) { toast.error(classErr.message); setSaving(false); return; }

    if (editing.school_id && form.transport_mode !== (editing.schools?.transport_mode ?? '')) {
      const { error: schoolErr } = await supabase
        .from('schools')
        .update({ transport_mode: form.transport_mode })
        .eq('id', editing.school_id);
      if (schoolErr) { toast.error(schoolErr.message); setSaving(false); return; }
    }

    toast.success('Schedule updated');
    logActivity({ action: 'updated', section: 'classes', description: `Updated schedule for "${getClassName(editing)}"` });
    setEditing(null);
    setSaving(false);
    load();
  };

  const assignInstructor = async (classRow: any, instructorName: string) => {
    const current = (classRow.instructor_names ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (current.includes(instructorName)) {
      toast.info(`${instructorName} is already assigned`);
      return;
    }
    const next = [...current, instructorName].join(', ');
    const { error } = await supabase.from('classes').update({ instructor_names: next }).eq('id', classRow.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Assigned ${instructorName}`);
    logActivity({ action: 'updated', section: 'classes', description: `Assigned ${instructorName} to "${getClassName(classRow)}"` });
    load();
  };

  const removeInstructor = async (classRow: any, instructorName: string) => {
    const next = (classRow.instructor_names ?? '')
      .split(',').map((s: string) => s.trim()).filter(Boolean)
      .filter((n: string) => n !== instructorName).join(', ');
    const { error } = await supabase.from('classes').update({ instructor_names: next }).eq('id', classRow.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Instructor removed');
    load();
  };

  const exportPng = async () => {
    const node = tableRefs.current[activeDay];
    if (!node) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.download = `Schedule_${activeDay}_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
      toast.success(`${activeDay} schedule exported`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to export');
    } finally { setExporting(false); }
  };

  if (authLoading) return null;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  const renderDayTable = (day: string) => {
    const dayRows = rowsByDay[day] ?? [];
    return (
      <div
        ref={el => { tableRefs.current[day] = el; }}
        className="p-6 bg-white min-w-[1100px]"
        style={{ color: '#000' }}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold" style={{ color: '#000' }}>{day} — Class Schedule</h2>
          <span className="text-xs" style={{ color: '#000' }}>Generated {format(new Date(), 'dd MMM yyyy')} · {dayRows.length} classes</span>
        </div>
        <table className="w-full border-collapse text-[12px]" style={{ color: '#000', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#fff', color: '#000' }}>
              {['School Name', 'Class Name', 'Timing', 'Students', 'Laptop Nos.', 'Topic of the Day', 'Instructor', 'Transport Mode', ''].map(h => (
                <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ border: '1px solid #000', color: '#000' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayRows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8" style={{ border: '1px solid #000', color: '#000' }}>No classes scheduled on {day}.</td></tr>
            )}
            {dayRows.map(r => (
              <tr
                key={r.id}
                className="align-top"
                style={{ background: dragOverRow === r.id ? '#f3f4f6' : '#fff', color: '#000' }}
                onDragOver={(e) => { e.preventDefault(); setDragOverRow(r.id); }}
                onDragLeave={() => setDragOverRow(prev => prev === r.id ? null : prev)}
                onDrop={(e) => {
                  e.preventDefault();
                  const name = e.dataTransfer.getData('text/plain');
                  setDragOverRow(null);
                  if (name) assignInstructor(r, name);
                }}
              >
                <td className="px-3 py-2 font-medium" style={{ border: '1px solid #000', color: '#000' }}>{r.schools?.name ?? '—'}</td>
                <td className="px-3 py-2 font-medium" style={{ border: '1px solid #000', color: '#000' }}>{getClassName(r)}</td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ border: '1px solid #000', color: '#000' }}>{r.timing || '—'}</td>
                <td className="px-3 py-2 text-center" style={{ border: '1px solid #000', color: '#000' }}>{r.students_count}</td>
                <td className="px-3 py-2 max-w-[180px]" style={{ border: '1px solid #000', color: '#000' }}>{r.laptop_nos || '—'}</td>
                <td className="px-3 py-2 max-w-[220px]" style={{ border: '1px solid #000', color: '#000' }}>{r.topic || '—'}</td>
                <td className="px-3 py-2" style={{ border: '1px solid #000', color: '#000' }}>
                  {r.instructor_names ? (
                    <div className="flex flex-wrap gap-1">
                      {r.instructor_names.split(',').map((n: string) => n.trim()).filter(Boolean).map((n: string) => (
                        <span key={n} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px]" style={{ border: '1px solid #000', color: '#000' }}>
                          {n}
                          <button
                            data-no-export
                            onClick={() => removeInstructor(r, n)}
                            className="hover:text-red-600"
                            title="Remove"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-3 py-2" style={{ border: '1px solid #000', color: '#000' }}>{r.schools?.transport_mode || '—'}</td>
                <td className="px-2 py-2 text-center" style={{ border: '1px solid #000' }} data-no-export>
                  <button onClick={() => openEdit(r)} title="Edit" style={{ color: '#000' }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><CalendarDays className="w-6 h-6" /> Instructor Schedule</h1>
          <p className="page-subtitle">Drag instructor blocks onto rows to assign. Editable: Timing, Instructors, Transport. Day-wise tabs.</p>
        </div>
        <Button onClick={exportPng} disabled={exporting || loading}>
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export {activeDay} PNG
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading schedule…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-4">
          {/* Instructor palette */}
          <Card className="lg:sticky lg:top-4 self-start">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <Users className="w-4 h-4" /> Instructors
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">Drag onto a class row to assign.</p>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {instructors.length === 0 && <p className="text-xs text-muted-foreground">No users found.</p>}
                {instructors.map(u => (
                  <div
                    key={u.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', u.full_name)}
                    className="flex items-center gap-2 px-2 py-2 rounded-md border bg-card hover:bg-accent cursor-grab active:cursor-grabbing text-xs"
                    title={u.email}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{u.full_name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Day tabs */}
          <Tabs value={activeDay} onValueChange={setActiveDay}>
            <TabsList className="mb-4 flex-wrap h-auto">
              {DAYS.map(d => (
                <TabsTrigger key={d} value={d}>{d.slice(0, 3)}</TabsTrigger>
              ))}
            </TabsList>
            {DAYS.map(d => (
              <TabsContent key={d} value={d}>
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    {renderDayTable(d)}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class — {editing && getClassName(editing)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Timing</Label>
              <Input value={form.timing} onChange={e => setForm(f => ({ ...f, timing: e.target.value }))} placeholder="e.g. 9:00 AM - 10:00 AM" />
            </div>
            <div className="space-y-2">
              <Label>Instructor(s) — comma separated</Label>
              <Input value={form.instructor_names} onChange={e => setForm(f => ({ ...f, instructor_names: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Transport Mode (applies to school: {editing?.schools?.name})</Label>
              <Input value={form.transport_mode} onChange={e => setForm(f => ({ ...f, transport_mode: e.target.value }))} placeholder="e.g. Bus, Van, Walk-in" />
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
