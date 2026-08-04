import { useEffect, useMemo, useState } from 'react';
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
import { ExternalLink, FileImage, FileVideo, FolderInput, Search, Trash2, Library } from 'lucide-react';

export type MediaRecord = {
  id: string;
  name: string;
  size: number;
  type: string;
  school: string;
  className: string;
  link?: string;
  fileId?: string;
  uploadedAt: string;
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

const callDrive = async (payload: Record<string, unknown>) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/upload-to-drive`, {
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

interface Props {
  schools: any[];
  classes: any[];
  getClassName: (cls: any) => string;
}

const MediaLibrary = ({ schools, classes, getClassName }: Props) => {
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSchool, setMoveSchool] = useState('');
  const [moveClass, setMoveClass] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setRecords(readMediaLibrary());
    sync();
    window.addEventListener('media-library-changed', sync);
    return () => window.removeEventListener('media-library-changed', sync);
  }, []);

  const schoolNames = useMemo(
    () => Array.from(new Set(records.map(r => r.school))).sort(),
    [records],
  );

  const filtered = useMemo(
    () => records.filter(r =>
      (schoolFilter === 'all' || r.school === schoolFilter) &&
      (!search || `${r.name} ${r.school} ${r.className}`.toLowerCase().includes(search.toLowerCase()))
    ),
    [records, search, schoolFilter],
  );

  const selectedIds = Object.keys(selected).filter(id => selected[id]);
  const moveClasses = classes.filter(c => c.school_id === moveSchool);

  const doDelete = async () => {
    setBusy(true);
    const targets = records.filter(r => selectedIds.includes(r.id));
    const removedIds: string[] = [];
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
      }
      removedIds.push(r.id);
    }
    const removed = removedIds.length;
    writeMediaLibrary(readMediaLibrary().filter(r => !removedIds.includes(r.id)));
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
    const next = readMediaLibrary().map(r => ({ ...r }));
    for (const r of next.filter(r => selectedIds.includes(r.id))) {
      const fileId = r.fileId ?? parseDriveId(r.link);
      if (fileId) {
        try {
          await callDrive({ mode: 'move', fileId, school: school.name, className: destination });
        } catch {
          failed++;
          continue;
        }
      }
      r.school = school.name;
      r.className = destination;
      moved++;
    }
    writeMediaLibrary(next);
    setSelected({});
    setMoveOpen(false);
    setBusy(false);
    if (failed) toast.error(`${failed} file(s) could not be moved in Google Drive`);
    if (moved) toast.success(`${moved} file(s) moved to ${school.name} / ${destination}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Library className="w-4 h-4" /> Media Library
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search media…" className="pl-9" />
          </div>
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {schoolNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
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

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No media yet. Files you upload from this device appear here.
          </p>
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
                {r.type?.startsWith('video')
                  ? <FileVideo className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <FileImage className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.school} / {r.className} · {formatSize(r.size)} · {new Date(r.uploadedAt).toLocaleString()}
                  </div>
                </div>
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
    </Card>
  );
};

export default MediaLibrary;
