import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeFields } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { CalendarDays, Plus, Trash2, Pencil, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameMonth, isSameDay } from 'date-fns';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToPdf } from '@/lib/exportPdf';
import ExportDropdown from '@/components/ExportDropdown';
import HolidayImportDialog from '@/components/HolidayImportDialog';

interface HolidayForm {
  name: string;
  date: string;
  school_id: string;
  description: string;
}

const emptyForm: HolidayForm = { name: '', date: '', school_id: '', description: '' };

const HolidayCalendar = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [form, setForm] = useState<HolidayForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data ?? []));
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from('holidays')
      .select('*, schools(name)')
      .order('date');
    setHolidays(data ?? []);
  };

  const filtered = useMemo(() => {
    let result = holidays;
    if (filterSchool && filterSchool !== 'all') {
      result = result.filter(h => h.school_id === filterSchool);
    }
    return result;
  }, [holidays, filterSchool]);

  const holidayDates = useMemo(() => {
    const dates = new Set<string>();
    filtered.forEach(h => dates.add(h.date));
    return dates;
  }, [filtered]);

  const holidaysForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return filtered.filter(h => h.date === dateStr);
  }, [filtered, selectedDate]);

  const setField = (key: keyof HolidayForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, school_id: filterSchool && filterSchool !== 'all' ? filterSchool : '' });
    setOpen(true);
  };

  const openEdit = (h: any) => {
    setEditId(h.id);
    setForm({ name: h.name, date: h.date, school_id: h.school_id, description: h.description ?? '' });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) { toast.error('Holiday name is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.school_id) { toast.error('School is required'); return; }
    setLoading(true);

    const payload = capitalizeFields({
      name: form.name.trim(),
      date: form.date,
      school_id: form.school_id,
      description: form.description.trim() || null,
      created_by: user.id,
    }, ['name', 'description']);

    if (editId) {
      const { error } = await supabase.from('holidays').update(payload).eq('id', editId);
      if (error) toast.error(error.message);
      else { toast.success('Holiday updated!'); setOpen(false); fetchHolidays(); }
    } else {
      const { error } = await supabase.from('holidays').insert(payload);
      if (error) toast.error(error.message);
      else { toast.success('Holiday added!'); setOpen(false); fetchHolidays(); }
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('holidays').delete().eq('id', deleteId);
    if (error) toast.error(error.message);
    else { toast.success('Holiday deleted'); fetchHolidays(); }
    setDeleteId(null);
  };

  const handleExportExcel = () => {
    const rows = filtered.map(h => ({
      'Holiday Name': h.name,
      'Date': format(parseISO(h.date), 'dd MMM yyyy'),
      'School': (h as any).schools?.name ?? '',
      'Description': h.description ?? '',
    }));
    exportToExcel({ filename: 'holidays.xlsx', sheetName: 'Holidays', rows });
  };

  const handleExportPdf = () => {
    const headers = ['Holiday Name', 'Date', 'School', 'Description'];
    const rows = filtered.map(h => [
      h.name,
      format(parseISO(h.date), 'dd MMM yyyy'),
      (h as any).schools?.name ?? '',
      h.description ?? '',
    ]);
    exportToPdf({ title: 'Holiday Calendar', headers, rows, filename: 'holidays.pdf' });
  };

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Holiday Calendar</h1>
          <p className="page-subtitle">Manage school holidays</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} />
          <HolidayImportDialog schools={schools} userId={user?.id ?? ''} onImported={fetchHolidays} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Holiday</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Holiday Name *</Label>
                  <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Diwali" required />
                </div>
                <div className="space-y-2">
                  <Label>School *</Label>
                  <Select value={form.school_id} onValueChange={v => setField('school_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                    <SelectContent>
                      {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.date && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.date ? format(parseISO(form.date), 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.date ? parseISO(form.date) : undefined}
                        onSelect={d => d && setField('date', format(d, 'yyyy-MM-dd'))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Optional details..." rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Saving...' : editId ? 'Update Holiday' : 'Add Holiday'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="w-full sm:w-64">
          <Select value={filterSchool} onValueChange={setFilterSchool}>
            <SelectTrigger><SelectValue placeholder="All Schools" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 border rounded-lg p-0.5">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon className="w-4 h-4 mr-1" /> Calendar
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-card rounded-xl border p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              className="w-full pointer-events-auto"
              modifiers={{
                holiday: (date) => holidayDates.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersClassNames={{
                holiday: 'bg-destructive/20 text-destructive font-bold rounded-full',
              }}
            />
          </div>

          {/* Selected Date Details */}
          <div className="bg-card rounded-xl border p-4">
            <h3 className="font-semibold text-foreground mb-3">
              {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
            </h3>
            {selectedDate && holidaysForDate.length === 0 && (
              <p className="text-sm text-muted-foreground">No holidays on this date.</p>
            )}
            <div className="space-y-3">
              {holidaysForDate.map(h => (
                <div key={h.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{h.name}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(h)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(h.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{(h as any).schools?.name}</Badge>
                  {h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No holidays added yet.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((h, i) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>{format(parseISO(h.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{(h as any).schools?.name}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{h.description ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(h)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(h.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default HolidayCalendar;
