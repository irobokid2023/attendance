import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileDown, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { exportToPdf } from '@/lib/exportPdf';

import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const MarketingCurriculum = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>('');
  const [progEdit, setProgEdit] = useState<any>(null);
  const [sessEdit, setSessEdit] = useState<any>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ['mkt-curriculum-programs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketing_curriculum_programs').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['mkt-curriculum-sessions', selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_curriculum_sessions')
        .select('*')
        .eq('program_id', selected)
        .order('session_no');
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveProgram = useMutation({
    mutationFn: async (row: any) => {
      if (!row.name?.trim()) throw new Error('Program name is required');
      const payload = {
        name: row.name.trim(),
        age_group: row.age_group || null,
        duration_weeks: row.duration_weeks ? Number(row.duration_weeks) : null,
        description: row.description || null,
      };
      const { error } = row.id
        ? await supabase.from('marketing_curriculum_programs').update(payload).eq('id', row.id)
        : await supabase.from('marketing_curriculum_programs').insert({ ...payload, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Program saved');
      setProgEdit(null);
      qc.invalidateQueries({ queryKey: ['mkt-curriculum-programs'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_curriculum_programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Program deleted');
      setSelected('');
      qc.invalidateQueries({ queryKey: ['mkt-curriculum-programs'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSession = useMutation({
    mutationFn: async (row: any) => {
      if (!row.title?.trim()) throw new Error('Session title is required');
      const payload = {
        program_id: selected,
        session_no: Number(row.session_no || 1),
        title: row.title.trim(),
        objectives: row.objectives || null,
        materials: row.materials || null,
        activities: row.activities || null,
      };
      const { error } = row.id
        ? await supabase.from('marketing_curriculum_sessions').update(payload).eq('id', row.id)
        : await supabase.from('marketing_curriculum_sessions').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Session saved');
      setSessEdit(null);
      qc.invalidateQueries({ queryKey: ['mkt-curriculum-sessions', selected] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_curriculum_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Session deleted');
      qc.invalidateQueries({ queryKey: ['mkt-curriculum-sessions', selected] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Programs</CardTitle>
            <Button size="sm" onClick={() => setProgEdit({ name: '' })}><Plus className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {!programs.length && <p className="text-sm text-muted-foreground">No programs yet.</p>}
            {(programs as any[]).map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-1 rounded-lg border px-3 py-2 text-sm',
                  selected === p.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                )}
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(p.id)}>
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[p.age_group, p.duration_weeks ? `${p.duration_weeks} weeks` : null].filter(Boolean).join(' · ') || '—'}
                  </span>
                </button>
                <Button size="sm" variant="ghost" onClick={() => setProgEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this program and its sessions?')) delProgram.mutate(p.id); }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {(programs as any[]).find((p) => p.id === selected)?.name ?? 'Sessions'}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selected || !(sessions as any[]).length}
                onClick={() => {
                  const prog = (programs as any[]).find((p) => p.id === selected);
                  if (!prog) return;
                  exportToPdf({
                    title: `${prog.name} — Age group: ${prog.age_group || '—'} · Duration: ${prog.duration_weeks ?? '—'} weeks`,
                    headers: ['#', 'Title', 'Objectives', 'Materials', 'Activities'],
                    rows: (sessions as any[]).map((s) => [
                      String(s.session_no), s.title ?? '', s.objectives ?? '', s.materials ?? '', s.activities ?? '',
                    ]),
                    filename: `${prog.name}.pdf`,
                  });
                }}
              >
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button
                size="sm"
                disabled={!selected}
                onClick={() => setSessEdit({ session_no: (sessions as any[]).length + 1, title: '' })}
              >
                <Plus className="mr-1 h-4 w-4" /> Add session
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a program to see its sessions.</p>
            ) : !sessions.length ? (
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="p-2">#</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Objectives</th>
                      <th className="p-2">Materials</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sessions as any[]).map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="p-2">{s.session_no}</td>
                        <td className="p-2 font-medium">{s.title}</td>
                        <td className="p-2 max-w-[220px] truncate">{s.objectives || '—'}</td>
                        <td className="p-2 max-w-[180px] truncate">{s.materials || '—'}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setSessEdit(s)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this session?')) delSession.mutate(s.id); }}>
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
      </div>

      {progEdit && (
        <Dialog open onOpenChange={(o) => !o && setProgEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{progEdit.id ? 'Edit' : 'Add'} program</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Name *</Label>
                <Input value={progEdit.name ?? ''} onChange={(e) => setProgEdit({ ...progEdit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Age group</Label>
                  <Input value={progEdit.age_group ?? ''} onChange={(e) => setProgEdit({ ...progEdit, age_group: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Duration (weeks)</Label>
                  <Input type="number" min={0} value={progEdit.duration_weeks ?? ''} onChange={(e) => setProgEdit({ ...progEdit, duration_weeks: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Description</Label>
                <Textarea rows={3} value={progEdit.description ?? ''} onChange={(e) => setProgEdit({ ...progEdit, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setProgEdit(null)}>Cancel</Button>
              <Button onClick={() => saveProgram.mutate(progEdit)} disabled={saveProgram.isPending}>
                <Save className="mr-1 h-4 w-4" /> Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {sessEdit && (
        <Dialog open onOpenChange={(o) => !o && setSessEdit(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{sessEdit.id ? 'Edit' : 'Add'} session</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Session no *</Label>
                  <Input type="number" min={1} value={sessEdit.session_no ?? ''} onChange={(e) => setSessEdit({ ...sessEdit, session_no: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Title *</Label>
                  <Input value={sessEdit.title ?? ''} onChange={(e) => setSessEdit({ ...sessEdit, title: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Objectives</Label>
                <Textarea rows={2} value={sessEdit.objectives ?? ''} onChange={(e) => setSessEdit({ ...sessEdit, objectives: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Materials</Label>
                <Textarea rows={2} value={sessEdit.materials ?? ''} onChange={(e) => setSessEdit({ ...sessEdit, materials: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Activities</Label>
                <Textarea rows={2} value={sessEdit.activities ?? ''} onChange={(e) => setSessEdit({ ...sessEdit, activities: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setSessEdit(null)}>Cancel</Button>
              <Button onClick={() => saveSession.mutate(sessEdit)} disabled={saveSession.isPending}>
                <Save className="mr-1 h-4 w-4" /> Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default MarketingCurriculum;
