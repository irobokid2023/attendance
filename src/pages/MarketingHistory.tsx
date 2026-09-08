import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const STATUS_LABEL: Record<string, string> = {
  interested: 'Interested',
  follow_up: 'Follow-up',
  deal_closed: 'Deal Closed',
  not_interested: 'Not Interested',
};

const MarketingHistory = () => {
  const [params, setParams] = useSearchParams();
  const schoolId = params.get('school') ?? '';

  const { data: schools = [] } = useQuery({
    queryKey: ['marketing-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketing_schools').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['marketing-school-contacts', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_school_contacts')
        .select('*')
        .eq('school_id', schoolId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['marketing-history-visits', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_visits')
        .select('*')
        .eq('school_id', schoolId)
        .order('visit_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: changes = [] } = useQuery({
    queryKey: ['marketing-history-changes', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_school_history')
        .select('*')
        .eq('school_id', schoolId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const school = (schools as any[]).find((s) => s.id === schoolId);

  return (
    <DashboardLayout>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Schools ({(schools as any[]).length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {!(schools as any[]).length && <p className="text-sm text-muted-foreground">No schools yet.</p>}
            {(schools as any[]).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('school', s.id);
                  setParams(next, { replace: true });
                }}
                className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted ${schoolId === s.id ? 'border-primary bg-muted' : ''}`}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[s.city, s.area].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{school?.name ?? 'School History'}</CardTitle>
              <Select
                value={schoolId}
                onValueChange={(v) => {
                  const next = new URLSearchParams(params);
                  next.set('school', v);
                  setParams(next, { replace: true });
                }}
              >
                <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select a school" /></SelectTrigger>
                <SelectContent>
                  {(schools as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            {school ? (
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">City:</span> {school.city || '—'}</p>
                <p><span className="text-muted-foreground">Area:</span> {school.area || '—'}</p>
                <p><span className="text-muted-foreground">Board:</span> {school.board || '—'}</p>
                <p><span className="text-muted-foreground">Type:</span> {school.type || '—'}</p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Website:</span>{' '}
                  {school.website ? (
                    <a href={school.website} target="_blank" rel="noreferrer" className="text-primary underline">{school.website}</a>
                  ) : '—'}
                </p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> {school.address || '—'}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Notes:</span> {school.notes || '—'}</p>
              </CardContent>
            ) : (
              <CardContent><p className="text-sm text-muted-foreground">Pick a school on the left.</p></CardContent>
            )}
          </Card>

          {schoolId && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Contacts</CardTitle></CardHeader>
                <CardContent>
                  {!contacts.length ? (
                    <p className="text-sm text-muted-foreground">No contacts recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {(contacts as any[]).map((c) => (
                        <div key={c.id} className="rounded-md border p-2 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{c.name}</span>
                            {c.is_primary && <Badge variant="secondary">Primary</Badge>}
                            {c.designation && <span className="text-xs text-muted-foreground">{c.designation}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[c.email, c.phone, c.whatsapp ? `WhatsApp: ${c.whatsapp}` : null].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Visit timeline</CardTitle></CardHeader>
                <CardContent>
                  {!visits.length ? (
                    <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
                  ) : (
                    <ol className="space-y-3 border-l pl-4">
                      {(visits as any[]).map((v) => (
                        <li key={v.id} className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{v.visit_date}</span>
                            <Badge variant="secondary">{STATUS_LABEL[v.status] ?? v.status}</Badge>
                            {v.amount != null && <span className="text-xs text-muted-foreground">amount: {v.amount}</span>}
                            {v.next_follow_up && <span className="text-xs text-muted-foreground">next: {v.next_follow_up}</span>}
                          </div>
                          {v.agenda && <p className="mt-1 text-sm"><span className="text-muted-foreground">Agenda:</span> {v.agenda}</p>}
                          {v.outcome && <p className="text-sm"><span className="text-muted-foreground">Outcome:</span> {v.outcome}</p>}
                          {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Change log</CardTitle></CardHeader>
                <CardContent>
                  {!changes.length ? (
                    <p className="text-sm text-muted-foreground">No changes logged yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                            <th className="p-2">When</th>
                            <th className="p-2">Field</th>
                            <th className="p-2">From</th>
                            <th className="p-2">To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(changes as any[]).map((c) => (
                            <tr key={c.id} className="border-b last:border-0">
                              <td className="p-2 whitespace-nowrap">{new Date(c.changed_at).toLocaleString()}</td>
                              <td className="p-2">{c.field}</td>
                              <td className="p-2 text-muted-foreground">{c.old_value || '—'}</td>
                              <td className="p-2">{c.new_value || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MarketingHistory;
