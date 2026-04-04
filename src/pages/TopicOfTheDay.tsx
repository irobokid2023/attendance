import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { CalendarIcon, Download, FileText, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/exportExcel';

const capitalize = (str: string) =>
  str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

const TopicOfTheDay = () => {
  const { user } = useAuth();
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

  useEffect(() => {
    Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('classes').select('id, name, school_id, grade, div, day').order('name'),
    ]).then(([schoolsRes, classesRes]) => {
      setSchools(schoolsRes.data ?? []);
      setAllClasses(classesRes.data ?? []);
    });
  }, []);

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
      const { error } = await supabase.from('topics').insert({
        class_id: filterClass,
        date: dateStr,
        topic: capitalize(topicText.trim()),
        created_by: user?.id || '',
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('This topic already exists for the selected class and date');
        } else {
          throw error;
        }
      } else {
        toast.success('Topic saved successfully!');
        setTopicText('');
      }
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
        .select('*, classes(name, grade, div, school_id, schools(name))')
        .order('date', { ascending: false });

      if (recSchool) {
        const classIds = recFilteredClasses.map(c => c.id);
        if (classIds.length > 0) {
          query = query.in('class_id', classIds);
        } else {
          setRecords([]);
          setLoadingRecords(false);
          return;
        }
      }
      if (recClass) {
        query = query.eq('class_id', recClass);
      }
      if (recDateFrom) {
        query = query.gte('date', format(recDateFrom, 'yyyy-MM-dd'));
      }
      if (recDateTo) {
        query = query.lte('date', format(recDateTo, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by class_id to compute session numbers
      const grouped: Record<string, any[]> = {};
      (data ?? []).forEach(r => {
        if (!grouped[r.class_id]) grouped[r.class_id] = [];
        grouped[r.class_id].push(r);
      });

      // Add session count per class
      const enriched = (data ?? []).map(r => ({
        ...r,
        totalSessions: grouped[r.class_id]?.length || 0,
      }));

      setRecords(enriched);
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
            <FileText className="w-3.5 h-3.5" /> View Records
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Select value={recSchool} onValueChange={setRecSchool}>
              <SelectTrigger><SelectValue placeholder="All Schools" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={recClass} onValueChange={setRecClass}>
              <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {recFilteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Popover open={recDateFromOpen} onOpenChange={setRecDateFromOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {recDateFrom ? format(recDateFrom, 'dd MMM yyyy') : 'From Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={recDateFrom}
                  onSelect={(d) => { setRecDateFrom(d); setRecDateFromOpen(false); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover open={recDateToOpen} onOpenChange={setRecDateToOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {recDateTo ? format(recDateTo, 'dd MMM yyyy') : 'To Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={recDateTo}
                  onSelect={(d) => { setRecDateTo(d); setRecDateToOpen(false); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
                  'No. Of Sessions': r.totalSessions,
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
                      <TableHead className="text-center">No. Of Sessions</TableHead>
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
                        <TableCell className="text-center">
                          <Badge variant="secondary">{r.totalSessions}</Badge>
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
      </Tabs>
    </DashboardLayout>
  );
};

export default TopicOfTheDay;
