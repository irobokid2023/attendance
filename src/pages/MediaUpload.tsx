import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, CheckCircle2, XCircle, FileImage, FileVideo, ExternalLink } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

type UploadItem = {
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  percent: number;
  message?: string;
  link?: string;
};

const MAX_FILES = 50;

const MediaUpload = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [askMore, setAskMore] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([
        fetchAllPaginated<any>(() => supabase.from('schools').select('id, name').order('name')),
        fetchAllPaginated<any>(() => supabase.from('classes').select('id, name, grade, div, school_id').order('name')),
      ]);
      setSchools(s);
      setClasses(c);
    })();
  }, []);

  const filteredClasses = useMemo(
    () => (schoolId ? classes.filter((c) => c.school_id === schoolId) : []),
    [classes, schoolId]
  );

  const selectedSchool = schools.find((s) => s.id === schoolId);
  const selectedClass = classes.find((c) => c.id === classId);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > MAX_FILES) {
      toast.warning(`You can upload a maximum of ${MAX_FILES} files at a time. Only the first ${MAX_FILES} were selected.`);
    }
    const limited = picked.slice(0, MAX_FILES);
    setFiles(limited);
    setItems(limited.map((f) => ({ name: f.name, status: 'pending', percent: 0 })));
    setUploadComplete(false);
  };

  const updateItem = (idx: number, patch: Partial<UploadItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // Use XHR so we get real per-file upload progress events.
  const uploadOne = (file: File, school: string, className: string, idx: number) =>
    new Promise<void>(async (resolve) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/upload-to-drive`;

      const fd = new FormData();
      fd.append('file', file);
      fd.append('school', school);
      fd.append('className', className);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.round((ev.loaded / ev.total) * 100);
        updateItem(idx, { status: 'uploading', percent: pct });
      };

      xhr.onload = () => {
        let body: any = {};
        try { body = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300) {
          updateItem(idx, { status: 'done', percent: 100, link: body?.file?.webViewLink });
        } else {
          updateItem(idx, { status: 'error', message: body?.error || `HTTP ${xhr.status}` });
        }
        resolve();
      };
      xhr.onerror = () => {
        updateItem(idx, { status: 'error', message: 'Network error' });
        resolve();
      };
      xhr.send(fd);
    });

  const handleUpload = async () => {
    if (!schoolId || !classId) return toast.error('Select a school and class');
    if (files.length === 0) return toast.error('Choose at least one file');
    if (!selectedSchool || !selectedClass) return;

    setUploading(true);
    const schoolName = selectedSchool.name;
    const className = getClassName(selectedClass);

    for (let i = 0; i < files.length; i++) {
      await uploadOne(files[i], schoolName, className, i);
    }

    setUploading(false);
    setItems((curr) => {
      const ok = curr.filter((n) => n.status === 'done').length;
      const fail = curr.length - ok;
      if (fail === 0) {
        toast.success(`Uploaded ${ok} file${ok === 1 ? '' : 's'} to Google Drive`);
      } else {
        toast.warning(`Done: ${ok}, failed: ${fail}`);
      }
      if (ok > 0) {
        setAskMore(true);
        setUploadComplete(true);
      }
      return curr;
    });
  };

  const resetForMore = () => {
    setFiles([]);
    setItems([]);
    setAskMore(false);
    setUploadComplete(false);
  };

  const overallPercent = items.length === 0
    ? 0
    : Math.round(items.reduce((a, b) => a + b.percent, 0) / items.length);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="page-title">Upload Media</h1>
          <p className="page-subtitle">Photos and videos are uploaded directly to Google Drive — nothing is stored in the app.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Destination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">School</label>
                <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setClassId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Class</label>
                <Select value={classId} onValueChange={setClassId} disabled={!schoolId}>
                  <SelectTrigger><SelectValue placeholder={schoolId ? 'Select class' : 'Select school first'} /></SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedSchool && selectedClass && (
              <p className="text-xs text-muted-foreground">
                Files will be saved to: <span className="font-medium text-foreground">iRobokid Media / {selectedSchool.name} / {getClassName(selectedClass)}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-accent/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to choose photos or videos</span>
              <span className="text-xs text-muted-foreground">You can select multiple files — maximum 50 at a time</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={onPick}
                disabled={uploading}
              />
            </label>

            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="p-2.5 rounded-md border border-border bg-card space-y-2">
                    <div className="flex items-center gap-3">
                      {files[i]?.type.startsWith('video')
                        ? <FileVideo className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <FileImage className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1 text-sm truncate">{it.name}</span>
                      {it.status === 'pending' && <span className="text-xs text-muted-foreground">Pending</span>}
                      {it.status === 'uploading' && (
                        <span className="text-xs font-medium tabular-nums text-primary">{it.percent}%</span>
                      )}
                      {it.status === 'done' && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          {it.link && (
                            <a href={it.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </>
                      )}
                      {it.status === 'error' && (
                        <span className="text-xs text-destructive flex items-center gap-1" title={it.message}>
                          <XCircle className="w-4 h-4" /> Failed
                        </span>
                      )}
                    </div>
                    {(it.status === 'uploading' || it.status === 'done') && (
                      <Progress value={it.percent} className="h-1.5" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overall progress</span>
                  <span className="font-medium tabular-nums text-primary">{overallPercent}%</span>
                </div>
                <Progress value={overallPercent} />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleUpload} disabled={uploading || files.length === 0 || !schoolId || !classId}>
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : uploadComplete ? `${items.filter((i) => i.status === 'done').length} Media Uploaded` : `Upload ${files.length || ''} to Drive`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={askMore} onOpenChange={setAskMore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload more media?</AlertDialogTitle>
            <AlertDialogDescription>
              Your files were uploaded successfully. Would you like to upload more photos or videos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAskMore(false)}>No, I'm done</AlertDialogCancel>
            <AlertDialogAction onClick={resetForMore}>Yes, upload more</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MediaUpload;
