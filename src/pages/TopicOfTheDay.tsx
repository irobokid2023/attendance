import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLogger';
import DashboardLayout from '@/components/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CalendarIcon, Download, FileText, Plus, Search, BookOpen, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/exportExcel';
import CurriculumImportDialog from '@/components/CurriculumImportDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const capitalize = (str: string) =>
  str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const TopicOfTheDay = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  // Edit record dialog state
  const [editRec, setEditRec] = useState<any | null>(null);
  const [editRecText, setEditRecText] = useState('');
  const [savingEditRec, setSavingEditRec] = useState(false);

  const [schools, setSchools] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);

  // Add Topic state
  const [filterSchool, setFilterSchool] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [topicText, setTopicText] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  // View Records state
  const [recSchool, setRecSchool] = useState('');
  const [recClass, setRecClass] = useState('');
  const [recDateFrom, setRecDateFrom] = useState<Date | undefined>();
  const [recDateTo, setRecDateTo] = useState<Date | undefined>();
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recDateFromOpen, setRecDateFromOpen] = useState(false);
  const [recDateToOpen, setRecDateToOpen] = useState(false);

  // Curriculum state
  const PROGRAMS = [
    'Advance Python Programming',
    'App Inventor (MIT)',
    'Arduino Electronics and Programming',
    'Arduino Robotics',
    'Coding (Scratch)',
    'Coding AI/Applied AI (Pictoblox)',
    'Electrics and Circuits (Breadboard Kit)',
    'Electrics and Circuits (Snap Kit)',
    'Lego Robotics - Ev3',
    'Lego Robotics - NxT',
    'Internet of Things',
    'Python Programming',
    'Robotics and AI',
    'STEM Explorers',
    'Young Engineers',
  ];
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [curProgram, setCurProgram] = useState('');
  const [curSession, setCurSession] = useState<string>('');
  const [curTopic, setCurTopic] = useState('');
  const [savingCurriculum, setSavingCurriculum] = useState(false);
  const [curFilterProgram, setCurFilterProgram] = useState('__all__');

  const loadCurriculum = async () => {
    const { data, error } = await (supabase as any)
      .from('curriculum')
      .select('*')
      .order('program_name', { ascending: true })
      .order('session_no', { ascending: true });
    if (error) { toast.error(error.message); return; }
    setCurriculum(data ?? []);
  };

  useEffect(() => {
    Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('classes').select('id, name, school_id, grade, div, day').order('name'),
    ]).then(([schoolsRes, classesRes]) => {
      setSchools(schoolsRes.data ?? []);
      setAllClasses(classesRes.data ?? []);
    });
    loadCurriculum();
  }, []);

  const handleAddCurriculum = async () => {
    if (!curProgram || !curSession || !curTopic.trim()) {
      toast.error('Program, Session No. and Topic Name are all required');
      return;
    }
    const sessionNum = parseInt(curSession, 10);
    if (isNaN(sessionNum) || sessionNum <= 0) {
      toast.error('Session No. must be a positive number');
      return;
    }
    setSavingCurriculum(true);
    const { error } = await (supabase as any).from('curriculum').upsert(
      {
        program_name: curProgram,
        session_no: sessionNum,
        topic_name: capitalize(curTopic.trim()),
        created_by: user?.id || null,
      },
      { onConflict: 'program_name,session_no' }
    );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Curriculum entry saved');
      logActivity({ action: 'created', section: 'curriculum', description: `Added curriculum: ${curProgram} — Session ${sessionNum}` });
      setCurTopic('');
      setCurSession('');
      loadCurriculum();
    }
    setSavingCurriculum(false);
  };

  const handleDeleteCurriculum = async (id: string) => {
    const { error } = await (supabase as any).from('curriculum').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Curriculum entry deleted');
    loadCurriculum();
  };

  const filteredCurriculum = useMemo(() => {
    if (curFilterProgram === '__all__') return curriculum;
    return curriculum.filter(c => c.program_name === curFilterProgram);
  }, [curriculum, curFilterProgram]);


  const filteredClasses = useMemo(() => {
    if (!filterSchool) return [];
    return allClasses.filter(c => c.school_id === filterSchool);
  }, [allClasses, filterSchool]);

  const recFilteredClasses = useMemo(() => {
    if (!recSchool) return allClasses;
    return allClasses.filter(c => c.school_id === recSchool);
  }, [allClasses, recSchool]);

  useEffect(() => { setFilterClass(''); }, [filterSchool]);
  useEffect(() => { setRecClass(''); }, [recSchool]);

  const handleSaveTopic = async () => {
    if (!filterClass || !topicText.trim()) {
      toast.error('Please select a class and enter a topic');
      return;
    }
    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      // Check if a topic already exists for this class & date to determine action label
      const { data: existing } = await supabase
        .from('topics')
        .select('id')
        .eq('class_id', filterClass)
        .eq('date', dateStr)
        .maybeSingle();

      const { error } = await supabase
        .from('topics')
        .upsert(
          {
            class_id: filterClass,
            date: dateStr,
            topic: capitalize(topicText.trim()),
            created_by: user?.id || '',
          },
          { onConflict: 'class_id,date' }
        );
      if (error) throw error;

      const cls = allClasses.find(c => c.id === filterClass);
      const clsLabel = cls ? [cls.name, cls.grade, cls.div].filter(Boolean).join(' - ') : 'class';
      if (existing) {
        toast.success('Topic updated successfully!');
        logActivity({ action: 'updated', section: 'topics', description: `Overwrote topic for ${clsLabel} on ${dateStr}` });
      } else {
        toast.success('Topic saved successfully!');
        logActivity({ action: 'created', section: 'topics', description: `Added topic for ${clsLabel}` });
      }
      setTopicText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  };

  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      let query = supabase
        .from('topics')
        .select('*, classes!inner(name, grade, div, school_id, schools(name))')
        .order('date', { ascending: false });

      if (recDateFrom) {
        query = query.gte('date', format(recDateFrom, 'yyyy-MM-dd'));
      }
      if (recDateTo) {
        query = query.lte('date', format(recDateTo, 'yyyy-MM-dd'));
      }
      if (recSchool) {
        query = query.eq('classes.school_id', recSchool);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRecords(data ?? []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Topic Of The Day</h1>
        <p className="page-subtitle">Enter and view daily topics for each class</p>
      </div>

      <Tabs defaultValue="add" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="add" className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Topic
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Record
          </TabsTrigger>
          <TabsTrigger value="curriculum" className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Curriculum
          </TabsTrigger>
        </TabsList>

        {/* ADD TOPIC TAB */}
        <TabsContent value="add">
          <div className="bg-card rounded-xl border p-6 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="mb-1.5 block">School</Label>
                <Select value={filterSchool} onValueChange={setFilterSchool}>
                  <SelectTrigger><SelectValue placeholder="Select School" /></SelectTrigger>
                  <SelectContent>
                    {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Class</Label>
                <Select value={filterClass} onValueChange={setFilterClass} disabled={!filterSchool}>
                  <SelectTrigger><SelectValue placeholder={filterSchool ? 'Select Class' : 'Select school first'} /></SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => { if (d) setSelectedDate(d); setDateOpen(false); }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="mb-1.5 block">Topic</Label>
                <Input
                  value={topicText}
                  onChange={e => setTopicText(e.target.value)}
                  placeholder="Enter topic of the day"
                />
              </div>
            </div>

            <Button onClick={handleSaveTopic} disabled={saving || !filterClass || !topicText.trim()}>
              {saving ? 'Saving...' : 'Save Topic'}
            </Button>
          </div>
        </TabsContent>

        {/* VIEW RECORDS TAB */}
        <TabsContent value="records">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 max-w-3xl">
            <div>
              <Label className="mb-1.5 block">School</Label>
              <Select value={recSchool || '__all__'} onValueChange={v => setRecSchool(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="All Schools" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Schools</SelectItem>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">From Date</Label>
              <Popover open={recDateFromOpen} onOpenChange={setRecDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recDateFrom ? format(recDateFrom, 'dd MMM yyyy') : 'From Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={recDateFrom} onSelect={(d) => { setRecDateFrom(d); setRecDateFromOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="mb-1.5 block">To Date</Label>
              <Popover open={recDateToOpen} onOpenChange={setRecDateToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recDateTo ? format(recDateTo, 'dd MMM yyyy') : 'To Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={recDateTo} onSelect={(d) => { setRecDateTo(d); setRecDateToOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <Button onClick={fetchRecords} disabled={loadingRecords}>
              <Search className="w-4 h-4 mr-1.5" />
              {loadingRecords ? 'Loading...' : 'Search Records'}
            </Button>
            {records.length > 0 && (
              <Button variant="outline" onClick={() => {
                const rows = records.map((r, i) => ({
                  '#': i + 1,
                  'School Name': (r.classes as any)?.schools?.name || '-',
                  'Class Name': r.classes ? getClassName(r.classes) : '-',
                  'Topic Of The Day': r.topic,
                  'Date': formatDate(r.date),
                }));
                exportToExcel({ filename: 'Topic_Of_The_Day.xlsx', sheetName: 'Topics', rows });
                toast.success('Excel exported successfully');
              }}>
                <Download className="w-4 h-4 mr-1.5" />
                Export Excel
              </Button>
            )}
          </div>

          {records.length > 0 && (
            <>
              <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 mb-4 w-fit">
                Total Records: {records.length}
              </Badge>
              <div className="bg-card rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>School Name</TableHead>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Topic Of The Day</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{(r.classes as any)?.schools?.name || '-'}</TableCell>
                        <TableCell className="font-medium">
                          {r.classes ? getClassName(r.classes) : '-'}
                        </TableCell>
                        <TableCell>{r.topic}</TableCell>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditRec(r); setEditRecText(r.topic ?? ''); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this topic?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the topic for {r.classes ? getClassName(r.classes) : 'class'} on {formatDate(r.date)}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    const { error } = await supabase.from('topics').delete().eq('id', r.id);
                                    if (error) { toast.error(error.message); return; }
                                    toast.success('Topic deleted');
                                    logActivity({ action: 'deleted', section: 'topics', description: `Deleted topic on ${r.date}` });
                                    fetchRecords();
                                  }}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}


          {records.length === 0 && !loadingRecords && (
            <div className="text-center py-20">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Click "Search Records" to view topic entries.</p>
            </div>
          )}
        </TabsContent>

        {/* CURRICULUM TAB */}
        <TabsContent value="curriculum">
          {isAdmin && (
            <div className="bg-card rounded-xl border p-6 max-w-2xl mb-6">
              <h3 className="font-heading font-semibold mb-4">Add Curriculum</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="mb-1.5 block">Program Name</Label>
                  <Select value={curProgram} onValueChange={setCurProgram}>
                    <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                    <SelectContent>
                      {PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Session No.</Label>
                  <Input type="number" min={1} value={curSession} onChange={e => setCurSession(e.target.value)} placeholder="e.g. 1" />
                </div>
              </div>
              <div className="mb-4">
                <Label className="mb-1.5 block">Topic Name</Label>
                <Input value={curTopic} onChange={e => setCurTopic(e.target.value)} placeholder="Enter topic name" />
              </div>
              <Button onClick={handleAddCurriculum} disabled={savingCurriculum}>
                {savingCurriculum ? 'Saving...' : 'Add Curriculum'}
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3 max-w-sm flex-1">
              <Label className="whitespace-nowrap">Filter by Program:</Label>
              <Select value={curFilterProgram} onValueChange={setCurFilterProgram}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Programs</SelectItem>
                  {PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && <CurriculumImportDialog programs={PROGRAMS} userId={user?.id ?? ''} onImported={loadCurriculum} />}
          </div>


          {filteredCurriculum.length > 0 ? (
            <>
              <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 mb-4 w-fit">
                Total Entries: {filteredCurriculum.length}
              </Badge>
              <div className="bg-card rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Program Name</TableHead>
                      <TableHead className="w-28">Session No.</TableHead>
                      <TableHead>Topic Name</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCurriculum.map((c, i) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.program_name}</TableCell>
                        <TableCell>{c.session_no}</TableCell>
                        <TableCell>{c.topic_name}</TableCell>
                        <TableCell>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCurriculum(c.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No curriculum entries yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editRec} onOpenChange={o => !o && setEditRec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {editRec && `${(editRec.classes as any)?.schools?.name ?? ''} — ${editRec.classes ? getClassName(editRec.classes) : ''} — ${formatDate(editRec.date)}`}
            </div>
            <div>
              <Label className="mb-1.5 block">Topic</Label>
              <Input value={editRecText} onChange={e => setEditRecText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRec(null)}>Cancel</Button>
            <Button disabled={savingEditRec || !editRecText.trim()} onClick={async () => {
              if (!editRec) return;
              setSavingEditRec(true);
              const newTopic = capitalize(editRecText.trim());
              const { error } = await supabase.from('topics').update({ topic: newTopic }).eq('id', editRec.id);
              if (error) { toast.error(error.message); setSavingEditRec(false); return; }
              toast.success('Topic updated');
              logActivity({ action: 'updated', section: 'topics', description: `Updated topic on ${editRec.date}` });
              setEditRec(null); setSavingEditRec(false); fetchRecords();
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );

};

export default TopicOfTheDay;
