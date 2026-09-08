import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type VisitStatus = 'interested' | 'follow_up' | 'deal_closed' | 'not_interested';

const Field = ({
  label,
  req,
  children,
  className,
}: { label: string; req?: boolean; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className ?? ''}`}>
    <Label className="text-xs">
      {label}
      {req && <span className="text-destructive"> *</span>}
    </Label>
    {children}
  </div>
);

const MarketingDailyLog = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [form, setForm] = useState({
    name: '', city: '', area: '', board: '', type: '', address: '', website: '', school_notes: '',
    visit_date: new Date().toISOString().slice(0, 10),
    status: 'interested' as VisitStatus,
    agenda: '', outcome: '', next_follow_up: '', amount: '', notes: '',
    contact_name: '', contact_designation: '', contact_email: '', contact_phone: '', contact_whatsapp: '',
  });


  const { data: schools = [] } = useQuery({
    queryKey: ['marketing-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketing_schools').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      let schoolId = selectedSchool;
      if (mode === 'new') {
        if (!form.name.trim()) throw new Error('School name is required');
        const { data: inserted, error } = await supabase
          .from('marketing_schools')
          .insert({
            name: form.name.trim(), city: form.city || null, area: form.area || null,
            board: form.board || null, type: form.type || null,
            address: form.address || null, website: form.website || null,
            notes: form.school_notes || null,
            created_by: user?.id ?? null,
          })
          .select('id')
          .single();
        if (error) throw error;
        schoolId = inserted.id;
        if (form.contact_name.trim()) {
          const { error: cErr } = await supabase.from('marketing_school_contacts').insert({
            school_id: schoolId,
            name: form.contact_name.trim(),
            designation: form.contact_designation || null,
            email: form.contact_email || null,
            phone: form.contact_phone || null,
            whatsapp: form.contact_whatsapp || null,
            is_primary: true,
          });
          if (cErr) throw cErr;
        }
      }
      if (!schoolId) throw new Error('Pick a school');
      const { error } = await supabase.from('marketing_visits').insert({
        school_id: schoolId,
        visit_date: form.visit_date,
        status: form.status,
        agenda: form.agenda || null,
        outcome: form.outcome || null,
        next_follow_up: form.next_follow_up || null,
        amount: form.amount === '' ? null : Number(form.amount),
        notes: form.notes || null,
        created_by: user?.id ?? null,
        coordinator_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Visit logged');
      qc.invalidateQueries({ queryKey: ['marketing-schools'] });
      qc.invalidateQueries({ queryKey: ['marketing-visits'] });
      setForm({
        ...form, agenda: '', outcome: '', next_follow_up: '', amount: '', notes: '',
        name: '', city: '', area: '', address: '', website: '', school_notes: '',
        contact_name: '', contact_designation: '', contact_email: '', contact_phone: '', contact_whatsapp: '',
      });
    },

    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Log a school visit</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
            <div className="flex gap-2">
              <Button type="button" variant={mode === 'new' ? 'default' : 'outline'} onClick={() => setMode('new')}>New school</Button>
              <Button type="button" variant={mode === 'existing' ? 'default' : 'outline'} onClick={() => setMode('existing')}>Existing school</Button>
            </div>

            {mode === 'existing' ? (
              <Field label="School" req>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                  <SelectContent>
                    {schools.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="School name" req><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
                <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                <Field label="Area"><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
                <Field label="Board"><Input value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} /></Field>
                <Field label="Type"><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
                <Field label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
                <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <Field label="School notes" className="sm:col-span-2"><Textarea rows={2} value={form.school_notes} onChange={(e) => setForm({ ...form, school_notes: e.target.value })} /></Field>
                <Field label="Contact name" className="sm:col-span-2"><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
                <Field label="Designation"><Input value={form.contact_designation} onChange={(e) => setForm({ ...form, contact_designation: e.target.value })} /></Field>
                <Field label="Email"><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
                <Field label="Phone"><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
                <Field label="WhatsApp"><Input value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} /></Field>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Visit date" req><Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} required /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as VisitStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="deal_closed">Deal Closed</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Next follow-up"><Input type="date" value={form.next_follow_up} onChange={(e) => setForm({ ...form, next_follow_up: e.target.value })} /></Field>
              <Field label="Amount"><Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            </div>


            <Field label="Agenda"><Textarea rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></Field>
            <Field label="Outcome"><Textarea rows={2} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} /></Field>
            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

            <Button type="submit" size="lg" disabled={submit.isPending} className="w-full">
              {submit.isPending ? 'Saving...' : 'Save visit'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default MarketingDailyLog;
