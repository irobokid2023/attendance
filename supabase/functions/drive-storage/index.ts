// Returns total bytes used by files under "iRobokid Media" folder in Google Drive
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_drive';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY') ?? '';

const authHeaders = () => ({
  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
  'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY,
});

async function findRootFolder(): Promise<string | null> {
  const q = `name='iRobokid Media' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
  const url = `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Drive search failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.files?.[0]?.id ?? null;
}

async function listChildren(parentId: string): Promise<{ id: string; mimeType: string; size?: string }[]> {
  const out: { id: string; mimeType: string; size?: string }[] = [];
  let pageToken: string | undefined;
  do {
    const q = `'${parentId}' in parents and trashed=false`;
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken, files(id,mimeType,size)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${GATEWAY}/drive/v3/files?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    out.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Drive connection not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rootId = await findRootFolder();
    if (!rootId) {
      return new Response(JSON.stringify({ ok: true, total_bytes: 0, file_count: 0, folder_count: 0, exists: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalBytes = 0;
    let fileCount = 0;
    let folderCount = 0;
    const stack: string[] = [rootId];
    const FOLDER_MIME = 'application/vnd.google-apps.folder';

    while (stack.length) {
      const parent = stack.pop()!;
      const children = await listChildren(parent);
      for (const c of children) {
        if (c.mimeType === FOLDER_MIME) {
          folderCount++;
          stack.push(c.id);
        } else {
          fileCount++;
          if (c.size) totalBytes += Number(c.size);
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      exists: true,
      total_bytes: totalBytes,
      file_count: fileCount,
      folder_count: folderCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
