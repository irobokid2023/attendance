import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Clock, MinusCircle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';

const TASKS: { key: string; label: string }[] = [
  { key: 'agreement_signed', label: 'Agreement Signed & Submitted to Yasmin' },
  { key: 'calendar_received', label: 'Calendar Received' },
  { key: 'reception_tv_setup', label: 'Reception TV Video Setup' },
  { key: 'banner_standee', label: 'Banner / Standee Provided' },
  { key: 'stem_certificates', label: 'STEM Certificates Prepared' },
  { key: 'posters_provided', label: 'Posters Provided' },
  { key: 'team_intro', label: 'Team Introduction Completed' },
  { key: 'permissions_obtained', label: 'Permissions Obtained' },
  { key: 'staff_birthdates', label: 'School Staff Names and Birthdates' },
  { key: 'school_magazine', label: 'School Magazine Article Submitted' },
  { key: 'quiz_book_material', label: 'Quiz Book & Take-Home Material Presented' },
];

type Status = 'done' | 'pending' | 'not_applicable';

const STATUS_META: Record<Status, { label: string; icon: any; cls: string }> = {
  done: { label: 'Done', icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25' },
  pending: { label: 'Pending', icon: Clock, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25' },
  not_applicable: { label: 'N/A', icon: MinusCircle, cls: 'bg-muted text-muted-foreground border-border hover:bg-muted/80' },
};

const NEXT: Record<Status, Status> = { pending: 'done', done: 'not_applicable', not_applicable: 'pending' };

const MiscTasks = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [savedRecords, setSavedRecords] = useState<Record<string, Status>>({});
  const [records, setRecords] = useState<Record<string, Status>>({}); // key = `${schoolId}:${taskKey}`
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: schoolsData }, { data: tasksData }] = await Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('misc_tasks').select('school_id, task_key, status'),
    ]);
    setSchools(schoolsData || []);
    const map: Record<string, Status> = {};
    (tasksData || []).forEach((r: any) => {
      map[`${r.school_id}:${r.task_key}`] = r.status as Status;
    });
    setSavedRecords(map);
    setRecords(map);
    setLoading(false);
  };

  const cycleStatus = (schoolId: string, taskKey: string) => {
    const cellKey = `${schoolId}:${taskKey}`;
    const current = records[cellKey] || 'pending';
    const next = NEXT[current];
    setRecords((p) => ({ ...p, [cellKey]: next }));
  };

  const dirtyKeys = useMemo(() => {
    const keys: string[] = [];
    Object.keys(records).forEach((k) => {
      if ((records[k] || 'pending') !== (savedRecords[k] || 'pending')) keys.push(k);
    });
    return keys;
  }, [records, savedRecords]);

  const handleSave = async () => {
    if (!user || dirtyKeys.length === 0) return;
    setSaving(true);
    const rows = dirtyKeys.map((k) => {
      const [school_id, task_key] = k.split(':');
      return { school_id, task_key, status: records[k], marked_by: user.id };
    });
    const { error } = await supabase
      .from('misc_tasks')
      .upsert(rows, { onConflict: 'school_id,task_key' });
    setSaving(false);
    if (error) {
      toast.error('Failed to save changes');
      return;
    }
    setSavedRecords({ ...records });
    toast.success(`Saved ${rows.length} change${rows.length > 1 ? 's' : ''}`);
    logActivity({
      action: 'updated',
      section: 'schools',
      description: `Updated ${rows.length} miscellaneous task${rows.length > 1 ? 's' : ''}`,
      metadata: { count: rows.length },
    });
  };

  const handleDiscard = () => setRecords({ ...savedRecords });

  const summary = useMemo(() => {
    const total = schools.length * TASKS.length;
    let done = 0, pending = 0, na = 0;
    schools.forEach((s) => {
      TASKS.forEach((t) => {
        const status = records[`${s.id}:${t.key}`] || 'pending';
        if (status === 'done') done++;
        else if (status === 'not_applicable') na++;
        else pending++;
      });
    });
    return { total, done, pending, na };
  }, [schools, records]);

  const hasChanges = dirtyKeys.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground tracking-tight">Miscellaneous Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track operational checklist tasks per school. Click any cell to cycle through Pending → Done → N/A, then save.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {dirtyKeys.length} unsaved
                </span>
                <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
                  Discard
                </Button>
              </>
            )}
            <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Done</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.done}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">N/A</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.na}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : schools.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No schools found. Add a school first to start tracking tasks.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="sticky left-0 z-10 bg-muted/50 backdrop-blur text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[220px] border-r">
                      School
                    </th>
                    {TASKS.map((t) => (
                      <th
                        key={t.key}
                        className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px] whitespace-normal align-bottom"
                      >
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school, idx) => (
                    <tr key={school.id} className={cn('border-b', idx % 2 === 1 && 'bg-muted/20')}>
                      <td className={cn(
                        'sticky left-0 z-10 px-4 py-3 font-medium text-sm text-foreground border-r min-w-[220px]',
                        idx % 2 === 1 ? 'bg-muted/40' : 'bg-background',
                      )}>
                        {school.name}
                      </td>
                      {TASKS.map((t) => {
                        const cellKey = `${school.id}:${t.key}`;
                        const status: Status = records[cellKey] || 'pending';
                        const meta = STATUS_META[status];
                        const Icon = meta.icon;
                        const isDirty = (records[cellKey] || 'pending') !== (savedRecords[cellKey] || 'pending');
                        return (
                          <td key={t.key} className="px-3 py-2">
                            <button
                              onClick={() => cycleStatus(school.id, t.key)}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all w-full justify-center',
                                meta.cls,
                                isDirty && 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background',
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {meta.label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MiscTasks;
