import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Download, History, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { exportToCsv } from '@/lib/exportCsv';

const STATUS_LABEL: Record<string, string> = {
  interested: 'Interested',
  follow_up: 'Follow-up',
  deal_closed: 'Deal Closed',
  not_interested: 'Not Interested',
};

const PAGE_SIZE = 15;

const Detail = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="grid grid-cols-3 gap-2">
    <span className="text-xs uppercase text-muted-foreground">{label}</span>
    <span className="col-span-2 break-words">{value === 0 ? '0' : value || '—'}</span>
  </div>
);

const MarketingDatabase = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<any>(null);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['marketing-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_visits')
        .select('*, marketing_schools(id, name, city, area, board, type, website, address)')
        .order('visit_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('marketing_visits').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} visit${ids.length > 1 ? 's' : ''}`);
      setSelected({});
      setActive(null);
      qc.invalidateQueries({ queryKey: ['marketing-visits'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (visits as any[]).filter((v) => {
      if (status !== 'all' && v.status !== status) return false;
      if (!q) return true;
      const school = v.marketing_schools;
      return [school?.name, school?.city, school?.area, school?.board, v.agenda, v.outcome, v.notes]
        .some((f) => String(f ?? '').toLowerCase().includes(q));
    });
  }, [visits, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allOnPage = pageData.length > 0 && pageData.every((v: any) => selected[v.id]);

  const download = () => {
    exportToCsv('visit-database.csv', filtered.map((v: any) => ({
      School: v.marketing_schools?.name ?? '',
      City: v.marketing_schools?.city ?? '',
      Area: v.marketing_schools?.area ?? '',
      Board: v.marketing_schools?.board ?? '',
      Date: v.visit_date,
      Status: STATUS_LABEL[v.status] ?? v.status,
      Agenda: v.agenda ?? '',
      Outcome: v.outcome ?? '',
      'Next Follow-up': v.next_follow_up ?? '',
      Amount: v.amount ?? '',
      Notes: v.notes ?? '',
    })));
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Visit Database ({filtered.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search schools, notes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full sm:w-56"
            />
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={download} disabled={!filtered.length}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => { if (confirm(`Delete ${selectedIds.length} visit(s)?`)) del.mutate(selectedIds); }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete ({selectedIds.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : !filtered.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No visits found.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 p-2">
                      <Checkbox
                        checked={allOnPage}
                        onCheckedChange={(c) => {
                          const next = { ...selected };
                          pageData.forEach((v: any) => { next[v.id] = !!c; });
                          setSelected(next);
                        }}
                      />
                    </th>
                    <th className="p-2">School</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Next</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((v: any) => (
                    <tr
                      key={v.id}
                      onClick={() => setActive(v)}
                      className={`cursor-pointer border-t hover:bg-muted/40 ${active?.id === v.id ? 'bg-muted/40' : ''}`}
                    >
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={!!selected[v.id]}
                          onCheckedChange={(c) => setSelected({ ...selected, [v.id]: !!c })}
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{v.marketing_schools?.name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{v.marketing_schools?.city ?? ''}</div>
                      </td>
                      <td className="p-2 whitespace-nowrap">{v.visit_date}</td>
                      <td className="p-2"><Badge variant="secondary">{STATUS_LABEL[v.status] ?? v.status}</Badge></td>
                      <td className="p-2 whitespace-nowrap">{v.amount ?? '—'}</td>
                      <td className="p-2 whitespace-nowrap">{v.next_follow_up ?? '—'}</td>
                      <td className="p-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="sm" variant="ghost" title="School history">
                          <Link to={`/marketing-history?school=${v.school_id}`}><History className="h-4 w-4" /></Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm('Delete this visit?')) del.mutate([v.id]); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t p-3 text-sm">
                <span>Page {currentPage} / {totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}

          <Card className="bg-muted/20">
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!active ? (
                <p className="text-muted-foreground">Select a row to view details.</p>
              ) : (
                <>
                  <Detail label="School" value={active.marketing_schools?.name} />
                  <Detail label="City" value={active.marketing_schools?.city} />
                  <Detail label="Area" value={active.marketing_schools?.area} />
                  <Detail label="Board" value={active.marketing_schools?.board} />
                  <Detail label="Date" value={active.visit_date} />
                  <Detail label="Status" value={STATUS_LABEL[active.status] ?? active.status} />
                  <Detail label="Agenda" value={active.agenda} />
                  <Detail label="Outcome" value={active.outcome} />
                  <Detail label="Follow-up" value={active.next_follow_up} />
                  <Detail label="Amount" value={active.amount} />
                  <Detail label="Notes" value={active.notes} />
                </>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default MarketingDatabase;
