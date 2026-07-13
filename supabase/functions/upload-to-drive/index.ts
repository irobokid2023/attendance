// Uploads a file to Google Drive into iRobokid Media/<School>/<Class>/
// Supports two modes:
//   - Legacy multipart: POST multipart/form-data with 'file' (used for small files)
//   - Resumable init:   POST JSON { mode:'init', fileName, mimeType, size, school, className }
//     Returns { sessionUrl } — the browser then PUTs the bytes directly to sessionUrl
//     (Google resumable session URLs need no auth; they support CORS from the browser),
//     which bypasses the edge-function body size limit and enables uploads up to 2 GB+.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_drive';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY') ?? '';

const authHeaders = () => ({
  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
  'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY,
});

async function findFolder(name: string, parentId: string): Promise<string | null> {
  const safeName = name.replace(/'/g, "\\'");
  const q = `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const url = `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Drive search failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!res.ok) throw new Error(`Drive folder create failed (${res.status}): ${await res.text()}`);
  return (await res.json()).id;
}

async function ensureFolder(name: string, parentId: string): Promise<string> {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return await createFolder(name, parentId);
}

async function ensureClassFolder(school: string, className: string): Promise<string> {
  const rootId = await ensureFolder('iRobokid Media', 'root');
  const schoolId = await ensureFolder(school, rootId);
  return await ensureFolder(className, schoolId);
}

async function pushToDrive(file: File, school: string, className: string) {
  const classId = await ensureClassFolder(school, className);

  const metadata = { name: file.name, parents: [classId] };
  const boundary = '-------lovable-' + crypto.randomUUID();
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const body = new Uint8Array(head.length + fileBytes.length + tail.length);
  body.set(head, 0);
  body.set(fileBytes, head.length);
  body.set(tail, head.length + fileBytes.length);

  const uploadRes = await fetch(`${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text();
    throw new Error(`Drive upload failed (${uploadRes.status}): ${txt}`);
  }
  return await uploadRes.json();
}

async function initResumable(
  fileName: string, mimeType: string, size: number, school: string, className: string,
) {
  const classId = await ensureClassFolder(school, className);
  const metadata = { name: fileName, parents: [classId] };

  const res = await fetch(
    `${GATEWAY}/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive resumable init failed (${res.status}): ${txt}`);
  }
  const sessionUrl = res.headers.get('location') || res.headers.get('Location');
  if (!sessionUrl) throw new Error('Drive did not return a resumable session URL');
  return { sessionUrl };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Drive connection not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = req.headers.get('content-type') || '';

    // Resumable init (JSON body)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (body?.mode === 'init') {
        const fileName = String(body.fileName ?? '').trim();
        const mimeType = String(body.mimeType ?? 'application/octet-stream');
        const size = Number(body.size ?? 0);
        const school = String(body.school ?? '').trim();
        const className = String(body.className ?? '').trim();
        if (!fileName || !size || !school || !className) {
          return new Response(JSON.stringify({ error: 'fileName, size, school and className are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const result = await initResumable(fileName, mimeType, size, school, className);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Unknown mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Legacy multipart upload (small files)
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const school = String(form.get('school') ?? '').trim();
    const className = String(form.get('className') ?? '').trim();

    if (!file) return new Response(JSON.stringify({ error: 'file is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!school) return new Response(JSON.stringify({ error: 'school is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!className) return new Response(JSON.stringify({ error: 'className is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const result = await pushToDrive(file, school, className);
    return new Response(JSON.stringify({ ok: true, file: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
