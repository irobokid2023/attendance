import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const STATUSES = ['prospect', 'active', 'paused', 'churned'] as const;
const MODES = ['Online', 'Offline', 'Hybrid'];

type ChildTable =
  | 'flite_programs'
  | 'flite_welcome_deliveries'
  | 'flite_kit_deliveries'
  | 'flite_school_teachers'
  | 'flite_trainings'
  | 'flite_refresher_sessions'
  | 'flite_class_observations';

type Column = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'url' | 'email' | 'select';
  options?: string[];
  min?: number;
  required?: boolean;
  wide?: boolean;
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v: string) => /^[0-9+\-\s()]{7,20}$/.test(v);
const isUrl = (v: string) => /^https?:\/\/.+/.test(v);

const Field = ({
  label, children, error, className,
}: { label: string; children: React.ReactNode; error?: string; className?: string }) => (
  <div className={`space-y-1.5 ${className ?? ''}`}>
    <Label className="text-xs">{label}</Label>
    {children}
    {error && <p className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" />{error}</p>}
  </div>
);

const ChildEditor = ({
  title, table, schoolId, columns, emptyHint,
}: { title: string; table: ChildTable; schoolId: string; columns: Column[]; emptyHint: string }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const { data: rows = [] } = useQuery({
    queryKey: [table, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select('*').eq('school_id', schoolId).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (row: any) => {
      const errs: Record<string, string> = {};
      for (const c of columns) {
        const val = String(row[c.key] ?? '').trim();
        if (c.required && !val) errs[c.key] = 'Required';
        else if (val && c.type === 'email' && !isEmail(val)) errs[c.key] = 'Invalid email';
        else if (val && c.type === 'url' && !isUrl(val)) errs[c.key] = 'Must start with http(s)://';
        else if (val && c.type === 'number' && Number(val) < (c.min ?? -Infinity)) errs[c.key] = `Must be ≥ ${c.min}`;
      }
      if (Object.keys(errs).length) { setRowErrors(errs); throw new Error('Please fix the highlighted fields'); }

      const payload: Record<string, any> = { school_id: schoolId };
      for (const c of columns) {
        const val = row[c.key];
        payload[c.key] = val === '' || val === undefined || val === null
          ? null
          : c.type === 'number' ? Number(val) : val;
      }
      const client = supabase.from(table) as any;
      const { error } = row.id
        ? await client.update(payload).eq('id', row.id)
        : await client.insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Saved');
      setEditing(null);
      setRowErrors({});
      qc.invalidateQueries({ queryKey: [table, schoolId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: [table, schoolId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        </div>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </div>

      {!rows.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing added yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                {columns.map((c) => <th key={c.key} className="p-2 whitespace-nowrap">{c.label}</th>)}
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {(rows as any[]).map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="max-w-[220px] truncate p-2">
                      {c.type === 'url' && r[c.key]
                        ? <a href={r[c.key]} target="_blank" rel="noreferrer" className="text-primary underline">Link</a>
                        : r[c.key] ?? '—'}
                    </td>
                  ))}
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this row?')) del.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => { if (!o) { setEditing(null); setRowErrors({}); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing.id ? 'Edit' : 'Add'} — {title}</DialogTitle></DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              {columns.map((c) => {
                const err = rowErrors[c.key];
                const onChange = (val: any) => {
                  setEditing({ ...editing, [c.key]: val });
                  if (err) setRowErrors((p) => { const n = { ...p }; delete n[c.key]; return n; });
                };
                return (
                  <Field
                    key={c.key}
                    label={`${c.label}${c.required ? ' *' : ''}`}
                    error={err}
                    className={c.wide ? 'md:col-span-2' : ''}
                  >
                    {c.type === 'select' ? (
                      <Select value={editing[c.key] ?? ''} onValueChange={onChange}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{(c.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                        min={c.min}
                        value={editing[c.key] ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => { setEditing(null); setRowErrors({}); }}>Cancel</Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
                <Save className="mr-1 h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const FliteSchools = () => {
  const qc = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: schools = [] } = useQuery({
    queryKey: ['flite-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('flite_schools').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools as any[];
    return (schools as any[]).filter((s) =>
      [s.name, s.city, s.region, s.tier].some((f) => String(f ?? '').toLowerCase().includes(q))
    );
  }, [schools, search]);

  const set = (key: string, val: any) => {
    setForm((p: any) => ({ ...p, [key]: val }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  const save = useMutation({
    mutationFn: async () => {
      const errs: Record<string, string> = {};
      if (!String(form.name ?? '').trim()) errs.name = 'School name is required';
      for (const k of ['principal_email', 'school_coord_email', 'mktg_coord_email']) {
        if (form[k] && !isEmail(form[k])) errs[k] = 'Invalid email';
      }
      for (const k of ['contact_no', 'principal_contact', 'school_coord_contact', 'mktg_coord_contact']) {
        if (form[k] && !isPhone(form[k])) errs[k] = 'Invalid phone number';
      }
      if (form.teachers_count !== '' && form.teachers_count != null && Number(form.teachers_count) < 0) {
        errs.teachers_count = 'Cannot be negative';
      }
      if (Object.keys(errs).length) { setErrors(errs); throw new Error('Please fix the highlighted fields'); }

      const payload: any = { ...form };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      for (const k of Object.keys(payload)) if (payload[k] === '') payload[k] = null;
      if (payload.teachers_count != null) payload.teachers_count = Number(payload.teachers_count);
      payload.name = String(form.name).trim();

      if (form.id) {
        const { error } = await supabase.from('flite_schools').update(payload).eq('id', form.id);
        if (error) throw error;
        return form.id as string;
      }
      const { data, error } = await supabase.from('flite_schools').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success('School saved');
      setSchoolId(id);
      setForm(null);
      qc.invalidateQueries({ queryKey: ['flite-schools'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flite_schools').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('School deleted');
      setSchoolId('');
      qc.invalidateQueries({ queryKey: ['flite-schools'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const active = (schools as any[]).find((s) => s.id === schoolId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Flite Schools</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
              <Button onClick={() => { setForm({ name: '', status: 'prospect' }); setErrors({}); }}>
                <Plus className="mr-1 h-4 w-4" /> New school
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!filtered.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No Flite schools yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="p-2">School</th>
                      <th className="p-2">City</th>
                      <th className="p-2">Region</th>
                      <th className="p-2">Tier</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s: any) => (
                      <tr
                        key={s.id}
                        className={`border-b last:border-0 cursor-pointer hover:bg-muted/40 ${schoolId === s.id ? 'bg-primary/5' : ''}`}
                        onClick={() => setSchoolId(s.id)}
                      >
                        <td className="p-2 font-medium">{s.name}</td>
                        <td className="p-2">{s.city ?? '—'}</td>
                        <td className="p-2">{s.region ?? '—'}</td>
                        <td className="p-2">{s.tier ?? '—'}</td>
                        <td className="p-2"><Badge variant="secondary">{s.status}</Badge></td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setForm(s); setErrors({}); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this school and all its records?')) del.mutate(s.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {active && (
          <Card>
            <CardHeader><CardTitle className="text-base">{active.name} — records</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="programs">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="programs">Programs</TabsTrigger>
                  <TabsTrigger value="welcome">Welcome Kits</TabsTrigger>
                  <TabsTrigger value="kits">Kit Deliveries</TabsTrigger>
                  <TabsTrigger value="teachers">Teachers</TabsTrigger>
                  <TabsTrigger value="trainings">Trainings</TabsTrigger>
                  <TabsTrigger value="refreshers">Refreshers</TabsTrigger>
                  <TabsTrigger value="observations">Observations</TabsTrigger>
                </TabsList>

                <TabsContent value="programs" className="pt-4">
                  <ChildEditor
                    title="Programs Offered" table="flite_programs" schoolId={schoolId}
                    emptyHint="List each course offered at this school along with kit details."
                    columns={[
                      { key: 'course_name', label: 'Course Name', required: true },
                      { key: 'grade', label: 'Grade' },
                      { key: 'kit_cost', label: 'Kit Cost', type: 'number', min: 0 },
                      { key: 'no_of_kits', label: 'No. of Kits', type: 'number', min: 0 },
                      { key: 'kit_student_sharing', label: 'Kit:Student Sharing' },
                      { key: 'shelf_life', label: 'Shelf Life' },
                      { key: 'divisions_per_grade', label: 'Divisions / Grade', type: 'number', min: 0 },
                      { key: 'curriculum_file_link', label: 'Curriculum Link', type: 'url', wide: true },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="welcome" className="pt-4">
                  <ChildEditor
                    title="Welcome Kit Deliveries" table="flite_welcome_deliveries" schoolId={schoolId}
                    emptyHint="Log each welcome kit handed over — poster, certificate, banner, etc."
                    columns={[
                      { key: 'date_delivered', label: 'Date', type: 'date', required: true },
                      { key: 'delivered_by', label: 'Delivered By' },
                      { key: 'delivered_to', label: 'Delivered To' },
                      { key: 'items', label: 'Items', wide: true },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="kits" className="pt-4">
                  <ChildEditor
                    title="Kit Delivery Log" table="flite_kit_deliveries" schoolId={schoolId}
                    emptyHint="Track each kit courier batch sent to the school."
                    columns={[
                      { key: 'couriered_date', label: 'Couriered Date', type: 'date', required: true },
                      { key: 'tracking_id', label: 'Tracking ID' },
                      { key: 'program_name', label: 'Program' },
                      { key: 'quantity', label: 'Qty', type: 'number', min: 0 },
                      { key: 'received_on', label: 'Received On', type: 'date' },
                      { key: 'prepared_by', label: 'Prepared By' },
                      { key: 'checked_by', label: 'Checked By' },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="teachers" className="pt-4">
                  <ChildEditor
                    title="School Teachers" table="flite_school_teachers" schoolId={schoolId}
                    emptyHint="School teachers who will run the programs."
                    columns={[
                      { key: 'full_name', label: 'Teacher Name', required: true },
                      { key: 'courses', label: 'Courses' },
                      { key: 'subjects', label: 'Subjects' },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="trainings" className="pt-4">
                  <ChildEditor
                    title="Training Sessions" table="flite_trainings" schoolId={schoolId}
                    emptyHint="Each training session delivered to school teachers."
                    columns={[
                      { key: 'session_date', label: 'Date', type: 'date', required: true },
                      { key: 'flite_teacher_name', label: 'Flite Trainer' },
                      { key: 'course', label: 'Course' },
                      { key: 'hours', label: 'Hours' },
                      { key: 'teachers_attended', label: 'Teachers Attended', type: 'number', min: 0 },
                      { key: 'certificates_given_date', label: 'Certificates Given', type: 'date' },
                      { key: 'mode', label: 'Mode', type: 'select', options: MODES },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="refreshers" className="pt-4">
                  <ChildEditor
                    title="Refresher Sessions" table="flite_refresher_sessions" schoolId={schoolId}
                    emptyHint="Follow-up refresher sessions after the main training."
                    columns={[
                      { key: 'session_date', label: 'Date', type: 'date', required: true },
                      { key: 'flite_teacher_name', label: 'Flite Trainer' },
                      { key: 'course', label: 'Course' },
                      { key: 'hours', label: 'Hours' },
                      { key: 'teachers_attended', label: 'Teachers Attended', type: 'number', min: 0 },
                      { key: 'mode', label: 'Mode', type: 'select', options: MODES },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="observations" className="pt-4">
                  <ChildEditor
                    title="Class Observations" table="flite_class_observations" schoolId={schoolId}
                    emptyHint="Observation visits to classes being run by school teachers."
                    columns={[
                      { key: 'session_date', label: 'Date', type: 'date', required: true },
                      { key: 'flite_teacher_name', label: 'Observed By' },
                      { key: 'course', label: 'Course' },
                      { key: 'hours', label: 'Hours' },
                      { key: 'school_teacher', label: 'School Teacher' },
                      { key: 'remarks', label: 'Remarks', wide: true },
                    ]}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {form && (
        <Dialog open onOpenChange={(o) => !o && setForm(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'New'} Flite school</DialogTitle></DialogHeader>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="commercial">Commercial &amp; Training</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="School Name *" error={errors.name} className="md:col-span-2">
                    <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field label="School Full Name" className="md:col-span-2">
                    <Input value={form.school_full_name ?? ''} onChange={(e) => set('school_full_name', e.target.value)} />
                  </Field>
                  <Field label="Region"><Input value={form.region ?? ''} onChange={(e) => set('region', e.target.value)} /></Field>
                  <Field label="Tier"><Input value={form.tier ?? ''} onChange={(e) => set('tier', e.target.value)} /></Field>
                  <Field label="Status">
                    <Select value={form.status ?? 'prospect'} onValueChange={(v) => set('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="City"><Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
                  <Field label="Contact No" error={errors.contact_no}>
                    <Input value={form.contact_no ?? ''} onChange={(e) => set('contact_no', e.target.value)} />
                  </Field>
                  <Field label="Address" className="md:col-span-2">
                    <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
                  </Field>
                  <Field label="Notes" className="md:col-span-2">
                    <Textarea rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="pt-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Principal Name"><Input value={form.principal_name ?? ''} onChange={(e) => set('principal_name', e.target.value)} /></Field>
                  <Field label="Principal Contact" error={errors.principal_contact}><Input value={form.principal_contact ?? ''} onChange={(e) => set('principal_contact', e.target.value)} /></Field>
                  <Field label="Principal Email" error={errors.principal_email}><Input value={form.principal_email ?? ''} onChange={(e) => set('principal_email', e.target.value)} /></Field>

                  <Field label="School Coordinator"><Input value={form.school_coord_name ?? ''} onChange={(e) => set('school_coord_name', e.target.value)} /></Field>
                  <Field label="Coordinator Contact" error={errors.school_coord_contact}><Input value={form.school_coord_contact ?? ''} onChange={(e) => set('school_coord_contact', e.target.value)} /></Field>
                  <Field label="Coordinator Email" error={errors.school_coord_email}><Input value={form.school_coord_email ?? ''} onChange={(e) => set('school_coord_email', e.target.value)} /></Field>

                  <Field label="Marketing Coordinator"><Input value={form.mktg_coord_name ?? ''} onChange={(e) => set('mktg_coord_name', e.target.value)} /></Field>
                  <Field label="Marketing Contact" error={errors.mktg_coord_contact}><Input value={form.mktg_coord_contact ?? ''} onChange={(e) => set('mktg_coord_contact', e.target.value)} /></Field>
                  <Field label="Marketing Email" error={errors.mktg_coord_email}><Input value={form.mktg_coord_email ?? ''} onChange={(e) => set('mktg_coord_email', e.target.value)} /></Field>
                </div>
              </TabsContent>

              <TabsContent value="commercial" className="pt-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Payment Terms"><Input value={form.payment_terms ?? ''} onChange={(e) => set('payment_terms', e.target.value)} /></Field>
                  <Field label="Invoice in Name of"><Input value={form.invoice_name ?? ''} onChange={(e) => set('invoice_name', e.target.value)} /></Field>
                  <Field label="Dates / Month for Training"><Input value={form.training_dates ?? ''} onChange={(e) => set('training_dates', e.target.value)} /></Field>
                  <Field label="Days Committed for Training"><Input value={form.training_days_committed ?? ''} onChange={(e) => set('training_days_committed', e.target.value)} /></Field>
                  <Field label="Kit Delivery Date"><Input type="date" value={form.kit_delivery_date ?? ''} onChange={(e) => set('kit_delivery_date', e.target.value)} /></Field>
                  <Field label="Welcome Kit Delivered"><Input type="date" value={form.welcome_kit_delivered_date ?? ''} onChange={(e) => set('welcome_kit_delivered_date', e.target.value)} /></Field>
                  <Field label="No. of Teachers (Training)" error={errors.teachers_count}>
                    <Input type="number" min={0} value={form.teachers_count ?? ''} onChange={(e) => set('teachers_count', e.target.value)} />
                  </Field>
                  <Field label="Training Mode">
                    <Select value={form.training_mode ?? ''} onValueChange={(v) => set('training_mode', v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="mr-1 h-4 w-4" /> {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default FliteSchools;
