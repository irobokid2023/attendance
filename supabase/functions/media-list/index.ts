// Lists media file METADATA ONLY (name, size, type, school/class, uploader, date)
// stored under "iRobokid Media/<School>/<Class>/" in Google Drive.
// No file contents or thumbnails are fetched, so the Records tab loads fast.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/google_drive';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY') ?? '';

const authHeaders = () => ({
  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
  'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function listAll(q: string, fields: string, maxPages = 20) {
  const out: any[] = [];
  let pageToken = '';
  let pages = 0;
  do {
    const params = new URLSearchParams({
      q,
      fields: `nextPageToken, files(${fields})`,
      pageSize: '1000',
      spaces: 'drive',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${GATEWAY}/drive/v3/files?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? '';
    pages++;
  } while (pageToken && pages < maxPages);
  return out;
}

// Short-lived cache so repeated visits/refreshes are instant.
let cache: { at: number; key: string; files: unknown[] } | null = null;
const CACHE_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Require an authenticated user.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      return json({ error: 'Drive connection not configured' }, 500);
    }

    let force = false;
    let filterSchool = '';
    let filterClassName = '';
    try {
      const body = await req.json();
      force = !!body?.refresh;
      filterSchool = String(body?.school ?? '').trim();
      filterClassName = String(body?.className ?? body?.class ?? '').trim();
    } catch { /* no body */ }

    const cacheKey = `${filterSchool}|${filterClassName}`;
    if (!force && cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_MS) {
      return json({ ok: true, cached: true, files: cache.files });
    }

    // 1) All folders in one shot, then rebuild the iRobokid Media tree locally.
    const folders = await listAll(
      `mimeType='application/vnd.google-apps.folder' and trashed=false`,
      'id,name,parents',
    );
    const byId = new Map(folders.map((f: any) => [f.id, f]));
    const root = folders.find((f: any) => f.name === 'iRobokid Media');
    if (!root) return json({ ok: true, files: [] });

    const classFolders = new Map<string, { school: string; className: string }>();
    for (const f of folders) {
      const parentId = (f as any).parents?.[0];
      if (!parentId) continue;
      const parent: any = byId.get(parentId);
      if (!parent) continue;
      if (parent.parents?.[0] === root.id) {
        const school = parent.name;
        const className = f.name;
        if (filterSchool && school !== filterSchool) continue;
        if (filterClassName && className !== filterClassName) continue;
        classFolders.set(f.id, { school, className });
      }
    }
    if (classFolders.size === 0) return json({ ok: true, files: [] });

    // 2) Metadata-only listing of non-folder files (no thumbnails, no content).
    // If filters are provided, scope the Drive query to the matched class folders.
    let fileQuery = `mimeType!='application/vnd.google-apps.folder' and trashed=false`;
    if (classFolders.size > 0 && classFolders.size <= 10) {
      const parentsIn = Array.from(classFolders.keys())
        .map(id => `'${id}' in parents`)
        .join(' or ');
      fileQuery = `${fileQuery} and (${parentsIn})`;
    }

    const allFiles = await listAll(fileQuery, 'id,name,mimeType,size,createdTime,webViewLink,appProperties,parents,md5Checksum,thumbnailLink');

    const files = allFiles
      .filter((f: any) => f.parents?.some((p: string) => classFolders.has(p)))
      .map((f: any) => {
        const parentId = f.parents.find((p: string) => classFolders.has(p))!;
        const loc = classFolders.get(parentId)!;
        return {
          fileId: f.id,
          name: f.name,
          type: f.mimeType,
          size: Number(f.size ?? 0),
          school: loc.school,
          className: loc.className,
          link: f.webViewLink,
          uploadedAt: f.createdTime,
          uploadedBy: f.appProperties?.uploadedBy ?? '',
          md5: f.md5Checksum ?? '',
        };
      });


    cache = { at: Date.now(), key: cacheKey, files };
    return json({ ok: true, files });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
