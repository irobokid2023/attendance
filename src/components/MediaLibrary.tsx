import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ExternalLink, FileImage, FileVideo, FolderInput, Search, Trash2, Library, RefreshCw, Copy, List, LayoutGrid } from 'lucide-react';

export type MediaRecord = {
  id: string;
  name: string;
  size: number;
  type: string;
  school: string;
  className: string;
  link?: string;
  fileId?: string;
  uploadedBy?: string;
  uploadedAt: string;
  md5?: string;
};

const STORAGE_KEY = 'irobokid.media.library';


const parseDriveId = (link?: string) => {
  if (!link) return undefined;
  const m = link.match(/\/d\/([^/]+)/) || link.match(/[?&]id=([^&]+)/);
  return m?.[1];
};

export const readMediaLibrary = (): MediaRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MediaRecord[]) : [];
  } catch {
    return [];
  }
};

export const writeMediaLibrary = (records: MediaRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event('media-library-changed'));
};

export const addMediaRecord = (rec: Omit<MediaRecord, 'id' | 'uploadedAt'>) => {
  const record: MediaRecord = {
    ...rec,
    fileId: rec.fileId ?? parseDriveId(rec.link),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uploadedAt: new Date().toISOString(),
  };
  writeMediaLibrary([record, ...readMediaLibrary()]);
};

const formatSize = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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

const callDrive = (payload: Record<string, unknown>) => callFn('upload-to-drive', payload);

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

// ---- Thumbnail / preview fetching -------------------------------------------
// Blob URLs are cached per (fileId, variant) for the session, in-flight requests
// are de-duplicated, and at most 4 requests run at once so Drive is not hammered.
// 429 / 5xx responses are retried with exponential backoff (honouring Retry-After).

const urlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

let active = 0;
const queue: (() => void)[] = [];
const MAX_CONCURRENT = 4;

const acquire = () =>
  new Promise<void>((resolve) => {
    if (active < MAX_CONCURRENT) { active++; resolve(); return; }
    queue.push(() => { active++; resolve(); });
  });

const release = () => {
  active--;
  queue.shift()?.();
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const requestMedia = async (fileId: string, thumb: boolean): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/media-file`;

  const attempts = 4;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(thumb ? { fileId, thumb: true, size: 320 } : { fileId }),
    });
    if (res.ok) return URL.createObjectURL(await res.blob());

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || i === attempts - 1) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    const retryAfter = Number(res.headers.get('Retry-After') ?? 0);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(500 * 2 ** i + Math.random() * 400, 6000));
  }
  throw new Error('Preview unavailable');
};

const getMediaUrl = (fileId: string, thumb: boolean): Promise<string> => {
  const key = `${fileId}|${thumb ? 't' : 'f'}`;
  const cached = urlCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async () => {
    await acquire();
    try {
      const u = await requestMedia(fileId, thumb);
      urlCache.set(key, u);
      return u;
    } finally {
      release();
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
};

const MediaThumb = ({ record, className = '' }: { record: MediaRecord; className?: string }) => {
  const thumbKey = record.fileId ? `${record.fileId}|t` : '';
  const [url, setUrl] = useState<string | null>(thumbKey ? urlCache.get(thumbKey) ?? null : null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isVideo = record.type?.startsWith('video');
  const isImage = record.type?.startsWith('image');
  // Thumbnails come from Drive itself, so videos get a poster frame too.
  const previewable = (isImage || isVideo) && !!record.fileId;

  useEffect(() => {
    if (!previewable || url) return;
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting) return;
      io.disconnect();
      try {
        const u = await getMediaUrl(record.fileId!, true);
        if (alive) setUrl(u);
      } catch {
        if (alive) setFailed(true);
      }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.fileId, previewable, url]);

  return (
    <div
      ref={ref}
      className={`shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center relative ${className}`}
    >
      {url ? (
        <>
          <img src={url} alt={record.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          {isVideo && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <FileVideo className="w-4 h-4 text-white" />
            </span>
          )}
        </>
      ) : failed || !previewable ? (
        isVideo ? <FileVideo className="w-5 h-5 text-muted-foreground" /> : <FileImage className="w-5 h-5 text-muted-foreground" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 border-t-transparent animate-spin" />
      )}
    </div>
  );
};


const MediaPreview = ({ record }: { record: MediaRecord }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isImage = record.type?.startsWith('image');

  useEffect(() => {
    if (!isImage || !record.fileId || record.size > MAX_PREVIEW_BYTES) return;
    let alive = true;
    (async () => {
      // Show the cached thumbnail instantly while full bytes stream in.
      const thumb = urlCache.get(`${record.fileId}|t`);
      if (thumb && alive) setUrl(thumb);
      try {
        const u = await getMediaUrl(record.fileId!, false);
        if (alive) setUrl(u);
      } catch {
        if (alive && !thumb) setError('Preview unavailable — Drive may be busy, try again');
      }
    })();
    return () => { alive = false; };
  }, [record.fileId, isImage, record.size]);

  if (record.type?.startsWith('video') && record.fileId) {
    return (
      <iframe
        title={record.name}
        src={`https://drive.google.com/file/d/${record.fileId}/preview`}
        className="w-full aspect-video rounded-md border border-border"
        allow="autoplay"
      />
    );
  }
  if (url) return <img src={url} alt={record.name} className="w-full max-h-[65vh] object-contain rounded-md" />;
  return (
    <div className="w-full h-48 flex items-center justify-center text-sm text-muted-foreground">
      {error || (record.size > MAX_PREVIEW_BYTES ? 'File too large to preview here' : 'Loading preview…')}
    </div>
  );
};

type DupeGroup = { key: string; exact: boolean; records: MediaRecord[] };

const buildDupeGroups = (records: MediaRecord[]): DupeGroup[] => {
  const byMd5 = new Map<string, MediaRecord[]>();
  const byNameSize = new Map<string, MediaRecord[]>();
  for (const r of records) {
    if (r.md5) {
      byMd5.set(r.md5, [...(byMd5.get(r.md5) ?? []), r]);
    } else {
      const k = `${r.name}|${r.size}`;
      byNameSize.set(k, [...(byNameSize.get(k) ?? []), r]);
    }
  }
  const groups: DupeGroup[] = [];
  const seen = new Set<string>();
  for (const [key, list] of byMd5) {
    if (list.length > 1) {
      groups.push({ key, exact: true, records: [...list].sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1)) });
      list.forEach((r) => seen.add(r.id));
    }
  }
  for (const [key, list] of byNameSize) {
    const rest = list.filter((r) => !seen.has(r.id));
    if (rest.length > 1) {
      groups.push({ key, exact: false, records: [...rest].sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1)) });
    }
  }
  return groups;
};




interface Props {
  schools: any[];
  classes: any[];
  getClassName: (cls: any) => string;
}

const MediaLibrary = ({ schools, classes, getClassName }: Props) => {
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [source, setSource] = useState<'device' | 'all'>('all');
  const [driveRecords, setDriveRecords] = useState<MediaRecord[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSchool, setMoveSchool] = useState('');
  const [moveClass, setMoveClass] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<MediaRecord | null>(null);
  const [dupesOpen, setDupesOpen] = useState(false);
  const [view, setView] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('irobokid.media.view') === 'grid' ? 'grid' : 'list'),
  );

  useEffect(() => { localStorage.setItem('irobokid.media.view', view); }, [view]);


  useEffect(() => {
    const sync = () => setRecords(readMediaLibrary());
    sync();
    window.addEventListener('media-library-changed', sync);
    return () => window.removeEventListener('media-library-changed', sync);
  }, []);

  const loadDrive = async (force = false) => {
    if (!schoolFilter || !classFilter || !selectedClassName) return;
    setLoadingDrive(true);
    try {
      let res: any;
      let lastErr: unknown = null;
      const payload = force
        ? { refresh: true, school: schoolFilter, className: selectedClassName }
        : { school: schoolFilter, className: selectedClassName };
      for (let attempt = 0; attempt < 2 && !res; attempt++) {
        try {
          res = await callFn('media-list', payload);
        } catch (err) {
          lastErr = err;
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
        }
      }
      if (!res) {
        throw lastErr ?? new Error('Media records service is unavailable');
      }
      const files = (res?.files ?? []) as any[];

      setDriveRecords(
        files
          .map((f) => ({
            id: f.fileId,
            fileId: f.fileId,
            name: f.name,
            size: Number(f.size ?? 0),
            type: f.type ?? '',
            school: f.school,
            className: f.className,
            link: f.link,
            uploadedBy: f.uploadedBy ?? '',
            uploadedAt: f.uploadedAt ?? new Date().toISOString(),
            md5: f.md5 ?? '',

          }))
          .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)),
      );
    } catch (e: any) {
      const msg = String(e?.message || '');
      setDriveRecords([]);
      toast.error(
        /Failed to fetch|NOT_FOUND|not found|Unknown mode/i.test(msg)
          ? 'Media records service is still starting up. Please refresh in a moment.'
          : msg || 'Could not load media records',
      );

    } finally {
      setLoadingDrive(false);
    }
  };


  useEffect(() => {
    if (source === 'all' && schoolFilter && classFilter) {
      loadDrive();
    } else if (source === 'all') {
      setDriveRecords([]);
    }
    setSelected({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, schoolFilter, classFilter]);

  const activeRecords = source === 'all' ? driveRecords : records;

  const schoolNames = useMemo(
    () => schools.map(s => s.name).sort(),
    [schools],
  );

  const selectedSchoolId = useMemo(
    () => schools.find(s => s.name === schoolFilter)?.id ?? '',
    [schools, schoolFilter],
  );

  const classOptions = useMemo(
    () => classes
      .filter(c => c.school_id === selectedSchoolId)
      .sort((a, b) => getClassName(a).localeCompare(getClassName(b))),
    [classes, selectedSchoolId, getClassName],
  );

  const selectedClassName = useMemo(
    () => classFilter ? getClassName(classOptions.find(c => c.id === classFilter) || {}) : '',
    [classFilter, classOptions, getClassName],
  );

  const filtered = useMemo(
    () => activeRecords.filter(r =>
      (schoolFilter === '' || r.school === schoolFilter) &&
      (classFilter === '' || r.className === selectedClassName) &&
      (!search || r.name.toLowerCase().includes(search.toLowerCase()))
    ),
    [activeRecords, search, schoolFilter, classFilter, selectedClassName],
  );

  const selectedIds = Object.keys(selected).filter(id => selected[id]);
  const moveClasses = classes.filter(c => c.school_id === moveSchool);

  const dupeGroups = useMemo(() => buildDupeGroups(filtered), [filtered]);
  const dupeExtras = dupeGroups.reduce((n, g) => n + g.records.length - 1, 0);

  // Keeps the oldest copy in each duplicate set and moves the rest to Drive trash
  // (recoverable for 30 days).
  const cleanDuplicates = async () => {
    setBusy(true);
    const trashedIds: string[] = [];
    let failed = 0;
    for (const g of dupeGroups) {
      for (const r of g.records.slice(1)) {
        const fileId = r.fileId ?? parseDriveId(r.link);
        if (!fileId) continue;
        try {
          await callDrive({ mode: 'trash', fileId });
          trashedIds.push(r.id);
        } catch {
          failed++;
        }
      }
    }
    setDriveRecords(prev => prev.filter(r => !trashedIds.includes(r.id)));
    writeMediaLibrary(readMediaLibrary().filter(r => !trashedIds.includes(r.id)));
    setBusy(false);
    setDupesOpen(false);
    if (failed) toast.error(`${failed} duplicate(s) could not be removed`);
    if (trashedIds.length) toast.success(`${trashedIds.length} duplicate(s) moved to Google Drive trash`);
  };


  const doDelete = async () => {
    setBusy(true);
    const targets = activeRecords.filter(r => selectedIds.includes(r.id));
    const removedIds: string[] = [];
    const removedFileIds: string[] = [];
    let failed = 0;
    for (const r of targets) {
      const fileId = r.fileId ?? parseDriveId(r.link);
      if (fileId) {
        try {
          await callDrive({ mode: 'delete', fileId });
        } catch {
          failed++;
          continue;
        }
        removedFileIds.push(fileId);
      }
      removedIds.push(r.id);
    }
    const removed = removedIds.length;
    writeMediaLibrary(
      readMediaLibrary().filter(r => {
        const fid = r.fileId ?? parseDriveId(r.link);
        return !removedIds.includes(r.id) && !(fid && removedFileIds.includes(fid));
      }),
    );
    setDriveRecords(prev => prev.filter(r => !removedIds.includes(r.id)));
    setSelected({});
    setDeleteOpen(false);
    setBusy(false);
    if (failed) toast.error(`${failed} file(s) could not be deleted from Google Drive`);
    if (removed) toast.success(`${removed} file(s) removed`);
  };

  const doMove = async () => {
    if (!moveSchool || !moveClass) return toast.error('Select a destination school and class');
    const school = schools.find(s => s.id === moveSchool);
    const cls = classes.find(c => c.id === moveClass);
    if (!school || !cls) return;
    setBusy(true);
    const destination = getClassName(cls);
    let moved = 0;
    let failed = 0;
    const movedFileIds: string[] = [];
    for (const r of activeRecords.filter(r => selectedIds.includes(r.id))) {
      const fileId = r.fileId ?? parseDriveId(r.link);
      if (fileId) {
        try {
          await callDrive({ mode: 'move', fileId, school: school.name, className: destination });
        } catch {
          failed++;
          continue;
        }
        movedFileIds.push(fileId);
      }
      moved++;
    }
    const relabel = (r: MediaRecord) => {
      const fid = r.fileId ?? parseDriveId(r.link);
      return fid && movedFileIds.includes(fid)
        ? { ...r, school: school.name, className: destination }
        : r;
    };
    writeMediaLibrary(readMediaLibrary().map(relabel));
    setDriveRecords(prev => prev.map(relabel));
    setSelected({});
    setMoveOpen(false);
    setBusy(false);
    if (failed) toast.error(`${failed} file(s) could not be moved in Google Drive`);
    if (moved) toast.success(`${moved} file(s) moved to ${school.name} / ${destination}`);
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Library className="w-4 h-4" /> Media Records
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={source} onValueChange={(v) => setSource(v as 'device' | 'all')}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All media (everyone)</SelectItem>
              <SelectItem value="device">This device only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search media…" className="pl-9" />
          </div>
          <Select value={schoolFilter} onValueChange={(v) => { setSchoolFilter(v); setClassFilter(''); }}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select school" />
            </SelectTrigger>
            <SelectContent>
              {schoolNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter} disabled={!schoolFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={schoolFilter ? 'Select class' : 'Select school first'} />
            </SelectTrigger>
            <SelectContent>
              {classOptions.map(c => {
                const label = getClassName(c);
                return <SelectItem key={c.id} value={c.id}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {source === 'all' && (
              <Button size="sm" variant="outline" onClick={() => loadDrive(true)} disabled={loadingDrive || !schoolFilter || !classFilter} aria-label="Refresh">
                <RefreshCw className={`w-4 h-4 ${loadingDrive ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <div className="flex rounded-md border border-border overflow-hidden">
              <Button
                size="sm"
                variant={view === 'list' ? 'secondary' : 'ghost'}
                className="rounded-none px-2.5"
                onClick={() => setView('list')}
                aria-label="List view"
                aria-pressed={view === 'list'}
                title="List view"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={view === 'grid' ? 'secondary' : 'ghost'}
                className="rounded-none px-2.5"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>


        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50">
            <span className="text-sm">{selectedIds.length} selected</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
                <FolderInput className="w-4 h-4 mr-1.5" /> Move
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            </div>
          </div>
        )}

        {dupeExtras > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md border border-warning/40 bg-warning/10">
            <Copy className="w-4 h-4 text-warning shrink-0" />
            <span className="text-sm">
              {dupeExtras} duplicate file{dupeExtras === 1 ? '' : 's'} found in this class
            </span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDupesOpen(true)}>
              Review duplicates
            </Button>
          </div>
        )}

        {loadingDrive && source === 'all' ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading media records…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {source === 'device'
              ? 'No media yet. Files you upload from this device appear here.'
              : !schoolFilter || !classFilter
              ? 'Select a school and class to load media records.'
              : 'No media found for the selected school and class.'}
          </p>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(r => (
              <div key={r.id} className="relative rounded-md border border-border overflow-hidden group">
                <input
                  type="checkbox"
                  className="h-4 w-4 absolute top-2 left-2 z-10"
                  checked={!!selected[r.id]}
                  onChange={(e) => setSelected(prev => ({ ...prev, [r.id]: e.target.checked }))}
                  aria-label={`Select ${r.name}`}
                />
                <button
                  type="button"
                  onClick={() => setPreviewRecord(r)}
                  className="block w-full text-left"
                  aria-label={`Preview ${r.name}`}
                >
                  <MediaThumb record={r} className="w-full aspect-square rounded-none group-hover:opacity-90 transition-opacity" />
                  <div className="p-2">
                    <div className="text-xs truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {formatSize(r.size)} · {new Date(r.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-md border border-border">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!selected[r.id]}
                  onChange={(e) => setSelected(prev => ({ ...prev, [r.id]: e.target.checked }))}
                />
                <button
                  type="button"
                  onClick={() => setPreviewRecord(r)}
                  className="shrink-0"
                  aria-label={`Preview ${r.name}`}
                >
                  <MediaThumb record={r} className="w-12 h-12 hover:opacity-80 transition-opacity" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRecord(r)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-sm truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {formatSize(r.size)} · {new Date(r.uploadedAt).toLocaleString()}
                  </div>
                </button>
                {r.link && (
                  <a href={r.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}


      </CardContent>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move {selectedIds.length} file(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">School</label>
              <Select value={moveSchool} onValueChange={(v) => { setMoveSchool(v); setMoveClass(''); }}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Class</label>
              <Select value={moveClass} onValueChange={setMoveClass} disabled={!moveSchool}>
                <SelectTrigger><SelectValue placeholder={moveSchool ? 'Select class' : 'Select school first'} /></SelectTrigger>
                <SelectContent>
                  {moveClasses.map(c => <SelectItem key={c.id} value={c.id}>{getClassName(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={doMove} disabled={busy}>{busy ? 'Moving…' : 'Move'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} file(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected files will be deleted from Google Drive and removed from this library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete(); }} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewRecord} onOpenChange={(o) => !o && setPreviewRecord(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{previewRecord?.name}</DialogTitle>
          </DialogHeader>
          {previewRecord && <MediaPreview record={previewRecord} />}
          {previewRecord && (
            <p className="text-xs text-muted-foreground">
              {formatSize(previewRecord.size)} · {new Date(previewRecord.uploadedAt).toLocaleString()}
            </p>
          )}
          <DialogFooter>
            {previewRecord?.link && (
              <Button asChild variant="outline">
                <a href={previewRecord.link} target="_blank" rel="noreferrer">
                  Open in Drive <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </a>
              </Button>
            )}
            <Button onClick={() => setPreviewRecord(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dupesOpen} onOpenChange={setDupesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Duplicate media ({dupeExtras} extra file{dupeExtras === 1 ? '' : 's'})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto">
            {dupeGroups.map((g) => (
              <div key={g.key} className="rounded-md border border-border p-2.5 space-y-2">
                <div className="text-xs text-muted-foreground">
                  {g.exact ? 'Identical files (same checksum)' : 'Possible duplicates (same name and size)'}
                </div>
                {g.records.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <MediaThumb record={r} className="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatSize(r.size)} · {new Date(r.uploadedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className={`text-xs ${i === 0 ? 'text-success' : 'text-destructive'}`}>
                      {i === 0 ? 'Keep (oldest)' : 'Remove'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Extra copies are moved to Google Drive trash and can be restored there for 30 days.
            Re-encoded or resized copies have a different checksum and may not be detected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupesOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={cleanDuplicates} disabled={busy || dupeExtras === 0}>
              {busy ? 'Removing…' : `Remove ${dupeExtras} duplicate${dupeExtras === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

  );
};

export default MediaLibrary;
