import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllAttendance';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, CheckCircle2, XCircle, FileImage, FileVideo, ExternalLink, Copy } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import MediaLibrary, { addMediaRecord } from '@/components/MediaLibrary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { fileMd5, findDuplicate, type ExistingFile } from '@/lib/mediaHash';
import { cn } from '@/lib/utils';



const getClassName = (cls: any): string => {
  const parts = [cls.name];
  if (cls.grade) parts.push(cls.grade);
  if (cls.div) parts.push(cls.div);
  return parts.join(' - ');
};

type UploadItem = {
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error' | 'skipped';
  percent: number;
  message?: string;
  link?: string;
  duplicate?: 'exact' | 'likely';
};

const MAX_FILES = 50;
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB per file

const callFn = async (fn: string, payload: Record<string, unknown>) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { return {}; }
};


const MediaUpload = () => {
  const { user } = useAuth();
  const uploaderLabel = () =>
    (user?.user_metadata?.full_name as string) || user?.email || 'Unknown user';
  const [tab, setTab] = useState<'upload' | 'records'>('upload');
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [askMore, setAskMore] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

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
  const destinationReady = Boolean(selectedSchool && selectedClass);


  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > MAX_FILES) {
      toast.warning(`You can upload a maximum of ${MAX_FILES} files at a time. Only the first ${MAX_FILES} were selected.`);
    }
    const limited = picked.slice(0, MAX_FILES);
    const tooBig = limited.filter((f) => f.size > MAX_FILE_SIZE);
    if (tooBig.length) {
      toast.error(`${tooBig.length} file(s) exceed the 2 GB limit and were skipped.`);
    }
    const accepted = limited.filter((f) => f.size <= MAX_FILE_SIZE);
    setFiles(accepted);
    setItems(accepted.map((f) => ({ name: f.name, status: 'pending', percent: 0 })));
    setUploadComplete(false);
  };

  // Duplicate detection: compare each picked file against what is already in the
  // destination Drive folder (exact MD5 match, or same name + size).
  useEffect(() => {
    if (files.length === 0 || !selectedSchool || !selectedClass) return;
    let cancelled = false;
    (async () => {
      setCheckingDupes(true);
      try {
        const res = await callFn('media-list', {
          school: selectedSchool.name,
          className: getClassName(selectedClass),
        });
        const existing: ExistingFile[] = ((res?.files ?? []) as any[]).map((f) => ({
          name: f.name, size: Number(f.size ?? 0), md5: f.md5 ?? '',
        }));
        let found = 0;
        for (let i = 0; i < files.length; i++) {
          if (cancelled) return;
          const md5 = await fileMd5(files[i]).catch(() => null);
          const dup = findDuplicate(files[i], md5, existing);
          if (dup) {
            found++;
            updateItem(i, { duplicate: dup.exact ? 'exact' : 'likely' });
          } else {
            updateItem(i, { duplicate: undefined });
          }
        }
        if (!cancelled && found > 0) {
          toast.warning(`${found} of the selected file(s) look already uploaded to this class.`);
        }
      } catch {
        /* duplicate check is best-effort */
      } finally {
        if (!cancelled) setCheckingDupes(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, schoolId, classId]);


  const updateItem = (idx: number, patch: Partial<UploadItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // Small files (< 20 MB) go through the edge function directly (multipart).
  // Larger files use a Google Drive resumable session: the edge function
  // creates the session, then the browser PUTs bytes straight to Google — this
  // bypasses the edge-function body size limit and supports files up to 2 GB.
  const RESUMABLE_THRESHOLD = 20 * 1024 * 1024;

  const uploadSmall = (file: File, school: string, className: string, idx: number) =>
    new Promise<void>(async (resolve) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/upload-to-drive`;

      const fd = new FormData();
      fd.append('file', file);
      fd.append('school', school);
      fd.append('className', className);
      fd.append('uploadedBy', uploaderLabel());

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
          addMediaRecord({
            name: file.name, size: file.size, type: file.type,
            school, className, link: body?.file?.webViewLink, fileId: body?.file?.id,
          });
        } else {
          updateItem(idx, { status: 'error', message: body?.error || `HTTP ${xhr.status}` });
        }
        resolve();
      };
      xhr.onerror = () => { updateItem(idx, { status: 'error', message: 'Network error' }); resolve(); };
      xhr.send(fd);
    });

  const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB chunks

  const uploadResumable = async (file: File, school: string, className: string, idx: number) => {
    try {
      updateItem(idx, { status: 'uploading', percent: 0 });
      // 1) Ask the edge function to open a resumable session with Google.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const initRes = await fetch(`https://${projectId}.supabase.co/functions/v1/upload-to-drive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'init',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          school,
          className,
          uploadedBy: uploaderLabel(),
        }),
      });
      const initJson = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(initJson?.error || `HTTP ${initRes.status}`);
      const sessionUrl: string | undefined = initJson?.sessionUrl;
      if (!sessionUrl) throw new Error('No resumable session URL returned');

      // 2) PUT the file to Google in chunks (bypasses proxy/body limits).
      const total = file.size;
      let offset = 0;
      let finished: any = null;

      while (offset < total) {
        const end = Math.min(offset + CHUNK_SIZE, total);
        const chunk = file.slice(offset, end);
        let res: Response | null = null;
        try {
          res = await fetch(sessionUrl, {
            method: 'PUT',
            headers: {
              'Content-Range': `bytes ${offset}-${end - 1}/${total}`,
            },
            body: chunk,
          });
        } catch {
          // Google frequently closes the connection on the final chunk after
          // committing the file — treat that as success.
          if (end >= total) { finished = {}; break; }
          throw new Error('Network error during upload');
        }

        if (res.status === 308) {
          const range = res.headers.get('range');
          const next = range ? Number(range.split('-')[1]) + 1 : end;
          offset = Number.isFinite(next) && next > offset ? next : end;
        } else if (res.ok) {
          finished = await res.json().catch(() => ({}));
          offset = total;
        } else {
          const txt = await res.text().catch(() => '');
          throw new Error(txt || `Upload failed (HTTP ${res.status})`);
        }

        updateItem(idx, { status: 'uploading', percent: Math.round((Math.min(offset, total) / total) * 100) });
      }

      const link = finished?.webViewLink;
      updateItem(idx, { status: 'done', percent: 100, link });
      addMediaRecord({
        name: file.name, size: file.size, type: file.type,
        school, className, link, fileId: finished?.id,
      });
    } catch (e: any) {
      updateItem(idx, { status: 'error', message: e?.message || 'Upload failed' });
    }
  };

  const uploadOne = (file: File, school: string, className: string, idx: number) =>
    file.size > RESUMABLE_THRESHOLD
      ? uploadResumable(file, school, className, idx)
      : uploadSmall(file, school, className, idx);

  const handleUpload = async () => {
    if (!schoolId || !classId) return toast.error('Select a school and class');
    if (files.length === 0) return toast.error('Choose at least one file');
    if (!selectedSchool || !selectedClass) return;

    setUploading(true);
    const schoolName = selectedSchool.name;
    const className = getClassName(selectedClass);
    const dupeFlags = items.map((it) => it.duplicate);
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      if (skipDuplicates && dupeFlags[i]) {
        skipped++;
        updateItem(i, { status: 'skipped', percent: 100, message: 'Already in Drive — skipped' });
        continue;
      }
      await uploadOne(files[i], schoolName, className, i);
    }

    setUploading(false);
    setItems((curr) => {
      const ok = curr.filter((n) => n.status === 'done').length;
      const fail = curr.filter((n) => n.status === 'error').length;
      if (fail === 0) {
        toast.success(
          `Uploaded ${ok} file${ok === 1 ? '' : 's'} to Google Drive` +
          (skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''),
        );
      } else {
        toast.warning(`Done: ${ok}, failed: ${fail}${skipped ? `, skipped: ${skipped}` : ''}`);
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'records')}>
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="space-y-6 mt-4">
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
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 transition-colors',
                destinationReady && !uploading
                  ? 'cursor-pointer hover:bg-accent/50'
                  : 'cursor-not-allowed opacity-60'
              )}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {destinationReady ? 'Click to choose photos or videos' : 'Select a school and class first'}
              </span>
              <span className="text-xs text-muted-foreground">
                {destinationReady
                  ? 'Up to 50 files at a time · max 2 GB per file'
                  : 'Uploading is disabled until a destination is chosen'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={onPick}
                disabled={uploading || !destinationReady}
              />
            </label>


            {items.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {checkingDupes
                      ? 'Checking for duplicates already in Drive…'
                      : items.some((i) => i.duplicate)
                      ? `${items.filter((i) => i.duplicate).length} possible duplicate(s) detected`
                      : 'No duplicates detected'}
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      disabled={uploading}
                    />
                    Skip duplicates
                  </label>
                </div>
                {items.map((it, i) => (
                  <div key={i} className="p-2.5 rounded-md border border-border bg-card space-y-2">
                    <div className="flex items-center gap-3">
                      {files[i]?.type.startsWith('video')
                        ? <FileVideo className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <FileImage className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1 text-sm truncate">{it.name}</span>
                      {it.duplicate && it.status === 'pending' && (
                        <span className="text-xs text-warning flex items-center gap-1">
                          <Copy className="w-3.5 h-3.5" />
                          {it.duplicate === 'exact' ? 'Already uploaded' : 'Possible duplicate'}
                        </span>
                      )}
                      {it.status === 'pending' && <span className="text-xs text-muted-foreground">Pending</span>}
                      {it.status === 'skipped' && (
                        <span className="text-xs text-muted-foreground" title={it.message}>Skipped</span>
                      )}
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

          </TabsContent>
          <TabsContent value="records" className="mt-4">
            <MediaLibrary schools={schools} classes={classes} getClassName={getClassName} />
          </TabsContent>
        </Tabs>
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
