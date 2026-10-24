import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircleQuestion, RotateCcw, Sparkles } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface SchoolOption {
  id: string;
  name: string;
}

interface ClassOption {
  id: string;
  displayName: string;
}

const AttendanceQA = () => {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [classId, setClassId] = useState<string>('all');
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [recordsAnalyzed, setRecordsAnalyzed] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('schools')
      .select('id, name')
      .order('name')
      .then(({ data }) => setSchools((data as SchoolOption[]) ?? []));
  }, []);

  useEffect(() => {
    setClasses([]);
    setClassId('all');
    if (!schoolId) return;
    supabase
      .from('classes')
      .select('id, name, grade, div')
      .eq('school_id', schoolId)
      .order('name')
      .then(({ data }) =>
        setClasses(
          ((data as { id: string; name: string; grade: string | null; div: string | null }[]) ?? []).map((c) => ({
            id: c.id,
            displayName: c.grade && c.div ? `${c.name} - ${c.grade} - ${c.div}` : c.name,
          })),
        ),
      );
  }, [schoolId]);

  const handleAsk = async () => {
    setError('');
    setAnswer('');
    setRecordsAnalyzed(null);

    if (!schoolId) {
      setError('Select a school first.');
      return;
    }
    if (!fromDate || !toDate || fromDate > toDate) {
      setError('Choose a valid date range.');
      return;
    }

    setLoading(true);
    const { data, error: invokeError } = await supabase.functions.invoke('attendance-qa', {
      body: {
        schoolId,
        classId: classId !== 'all' ? classId : undefined,
        fromDate,
        toDate,
        question: question.trim() || undefined,
      },
    });
    setLoading(false);

    if (data?.error) {
      setError(data.error);
      return;
    }
    if (invokeError) {
      setError('Could not reach the assistant. Please try again in a moment.');
      return;
    }
    setAnswer(data?.answer ?? '');
    setRecordsAnalyzed(typeof data?.recordsAnalyzed === 'number' ? data.recordsAnalyzed : null);
  };

  const handleReset = () => {
    setSchoolId('');
    setClasses([]);
    setClassId('all');
    setFromDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    setToDate(format(new Date(), 'yyyy-MM-dd'));
    setQuestion('');
    setAnswer('');
    setRecordsAnalyzed(null);
    setError('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ask About Attendance Changes</h1>
          <p className="text-muted-foreground mt-1">
            Pick a school, class and date range, ask a question, and the assistant summarizes who
            updated what and when from the change history.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircleQuestion className="h-4 w-4" />
              Your question
            </CardTitle>
            <CardDescription>
              Leave the question empty to get a general summary of attendance changes in the scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>School</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId} disabled={!schoolId}>
                  <SelectTrigger>
                    <SelectValue placeholder={schoolId ? 'All classes' : 'Select school first'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From date</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To date</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question (optional)</Label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Who changed the attendance for this class last week, and for which topics?"
                rows={3}
                maxLength={500}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleAsk} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing history...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Ask
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={loading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {answer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Summary
              </CardTitle>
              {recordsAnalyzed !== null && (
                <CardDescription>
                  Based on {recordsAnalyzed} change record{recordsAnalyzed === 1 ? '' : 's'} in the
                  selected scope.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline">{fromDate} → {toDate}</Badge>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AttendanceQA;
