// Returns total bytes used by files under "iRobokid Media" folder in Google Drive
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
  const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`Drive search failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.files?.[0]?.id ?? null;
}

type DriveFile = { id: string; mimeType: string; size?: string };

class DriveRateLimitError extends Error {
  constructor() {
    super('Google Drive is temporarily rate limited. Try again in 60 seconds.');
    this.name = 'DriveRateLimitError';
  }
}

async function listChildren(parentIds: string[]): Promise<DriveFile[]> {
  const out: { id: string; mimeType: string; size?: string }[] = [];
  let pageToken: string | undefined;
  do {
    const parentQuery = parentIds
      .map((id) => `'${id.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}' in parents`)
      .join(' or ');
    const q = `(${parentQuery}) and trashed=false`;
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken, files(id,mimeType,size,parents)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${GATEWAY}/drive/v3/files?${params.toString()}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status === 429) throw new DriveRateLimitError();
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    out.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const unauthorized = (msg = 'Unauthorized', status = 401) =>
  new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type DriveUsage = {
  exists: boolean;
  total_bytes: number;
  file_count: number;
  folder_count: number;
};

let usageCache: { at: number; value: DriveUsage } | null = null;
let usageScan: Promise<DriveUsage> | null = null;
const USAGE_CACHE_MS = 5 * 60 * 1000;
const USAGE_STALE_MAX_MS = 30 * 60 * 1000;

async function scanDriveUsage(): Promise<DriveUsage> {
  const rootId = await findRootFolder();
  if (!rootId) return { exists: false, total_bytes: 0, file_count: 0, folder_count: 0 };

  let totalBytes = 0;
  let fileCount = 0;
  let folderCount = 0;
  let foldersToVisit = [rootId];
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  // Combine parent folders into each query to reduce connector calls and avoid rate limits.
  while (foldersToVisit.length > 0) {
    const currentLevel = foldersToVisit;
    foldersToVisit = [];
    const filesById = new Map<string, DriveFile>();
    const parentBatches = Array.from({ length: Math.ceil(currentLevel.length / 20) }, (_, index) =>
      currentLevel.slice(index * 20, (index + 1) * 20),
    );
    for (let i = 0; i < parentBatches.length; i += 2) {
      const results = await Promise.all(parentBatches.slice(i, i + 2).map(listChildren));
      for (const children of results) {
        for (const child of children) filesById.set(child.id, child);
      }
    }

    for (const child of filesById.values()) {
      if (child.mimeType === FOLDER_MIME) {
        folderCount += 1;
        foldersToVisit.push(child.id);
      } else {
        fileCount += 1;
        if (child.size) totalBytes += Number(child.size);
      }
    }
  }
  return { exists: true, total_bytes: totalBytes, file_count: fileCount, folder_count: folderCount };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Require an authenticated admin caller
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return unauthorized('Missing authorization');
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return unauthorized();
    const { data: isAdmin } = await userClient.rpc('has_role', {
      _user_id: userData.user.id, _role: 'admin',
    });
    if (!isAdmin) return unauthorized('Forbidden: admin role required', 403);

    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Drive connection not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (usageCache && Date.now() - usageCache.at < USAGE_CACHE_MS) {
      return new Response(JSON.stringify({ ok: true, ...usageCache.value, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!usageScan) {
      usageScan = scanDriveUsage().finally(() => { usageScan = null; });
    }
    let usage: DriveUsage;
    try {
      usage = await usageScan;
    } catch (error) {
      if (error instanceof DriveRateLimitError && usageCache && Date.now() - usageCache.at < USAGE_STALE_MAX_MS) {
        return new Response(JSON.stringify({ ok: true, ...usageCache.value, cached: true, stale: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }
    usageCache = { at: Date.now(), value: usage };
    return new Response(JSON.stringify({ ok: true, ...usage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const rateLimited = e instanceof DriveRateLimitError;
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: rateLimited ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(rateLimited ? { 'Retry-After': '60' } : {}) },
    });
  }
});
