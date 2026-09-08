// v2: adds mode:"list" for shared media records
// Uploads a file to Google Drive into iRobokid Media/<School>/<Class>/
// Supports two modes:
//   - Legacy multipart: POST multipart/form-data with 'file' (used for small files)
//   - Resumable init:   POST JSON { mode:'init', fileName, mimeType, size, school, className }
//     Returns { sessionUrl } — the browser then PUTs the bytes directly to sessionUrl
//     (Google resumable session URLs need no auth; they support CORS from the browser),
//     which bypasses the edge-function body size limit and enables uploads up to 2 GB+.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

async function pushToDrive(file: File, school: string, className: string, uploadedBy = '') {
  const classId = await ensureClassFolder(school, className);

  const metadata: Record<string, unknown> = { name: file.name, parents: [classId] };
  if (uploadedBy) metadata.appProperties = { uploadedBy };
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
  fileName: string, mimeType: string, size: number, school: string, className: string, uploadedBy = '',
) {
  const classId = await ensureClassFolder(school, className);
  const metadata: Record<string, unknown> = { name: fileName, parents: [classId] };
  if (uploadedBy) metadata.appProperties = { uploadedBy };

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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const unauthorized = (msg = 'Unauthorized', status = 401) =>
  new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Require an authenticated caller with an assigned role
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return unauthorized('Missing authorization');
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return unauthorized();
    const [{ data: isAdmin }, { data: isInstructor }] = await Promise.all([
      userClient.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' }),
      userClient.rpc('has_role', { _user_id: userData.user.id, _role: 'instructor' }),
    ]);
    if (!isAdmin && !isInstructor) return unauthorized('Forbidden: no role assigned', 403);

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
        const uploadedBy = String(body.uploadedBy ?? '').trim();
        const result = await initResumable(fileName, mimeType, size, school, className, uploadedBy);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (body?.mode === 'list') {
        const listChildren = async (parentId: string, folders: boolean) => {
          const q = `'${parentId}' in parents and trashed=false and ${folders ? '' : 'not '}mimeType='application/vnd.google-apps.folder'`;
          const out: any[] = [];
          let pageToken = '';
          do {
            const url = `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}` +
              `&fields=nextPageToken,files(id,name,mimeType,size,createdTime,webViewLink,appProperties)&pageSize=1000` +
              (pageToken ? `&pageToken=${pageToken}` : '');
            const r = await fetch(url, { headers: authHeaders() });
            if (!r.ok) throw new Error(`Drive list failed (${r.status}): ${await r.text()}`);
            const j = await r.json();
            out.push(...(j.files ?? []));
            pageToken = j.nextPageToken ?? '';
          } while (pageToken);
          return out;
        };

        const rootId = await findFolder('iRobokid Media', 'root');
        if (!rootId) {
          return new Response(JSON.stringify({ ok: true, files: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const schools = await listChildren(rootId, true);
        const files: any[] = [];
        for (const s of schools) {
          const classes = await listChildren(s.id, true);
          const perClass = await Promise.all(
            classes.map(async (c: any) => {
              const kids = await listChildren(c.id, false);
              return kids.map((f: any) => ({
                fileId: f.id,
                name: f.name,
                type: f.mimeType,
                size: Number(f.size ?? 0),
                school: s.name,
                className: c.name,
                link: f.webViewLink,
                uploadedAt: f.createdTime,
                uploadedBy: f.appProperties?.uploadedBy ?? '',
              }));
            }),
          );
          perClass.forEach((arr) => files.push(...arr));
        }
        return new Response(JSON.stringify({ ok: true, files }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Move a file to Drive trash (recoverable for 30 days) — used by duplicate cleanup.
      if (body?.mode === 'trash') {
        const fileId = String(body.fileId ?? '').trim();
        if (!fileId) {
          return new Response(JSON.stringify({ error: 'fileId is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const res = await fetch(`${GATEWAY}/drive/v3/files/${fileId}?fields=id,trashed`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error(`Drive trash failed [${res.status}]: ${txt}`);
          return new Response(JSON.stringify({ error: `Drive trash failed (${res.status}): ${txt}` }), {
            status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (body?.mode === 'delete') {

        const fileId = String(body.fileId ?? '').trim();
        if (!fileId) {
          return new Response(JSON.stringify({ error: 'fileId is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const res = await fetch(`${GATEWAY}/drive/v3/files/${fileId}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        if (!res.ok && res.status !== 404) {
          const txt = await res.text();
          return new Response(JSON.stringify({ error: `Drive delete failed (${res.status}): ${txt}` }), {
            status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (body?.mode === 'move') {
        const fileId = String(body.fileId ?? '').trim();
        const school = String(body.school ?? '').trim();
        const className = String(body.className ?? '').trim();
        if (!fileId || !school || !className) {
          return new Response(JSON.stringify({ error: 'fileId, school and className are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const targetId = await ensureClassFolder(school, className);
        const metaRes = await fetch(`${GATEWAY}/drive/v3/files/${fileId}?fields=parents`, { headers: authHeaders() });
        if (!metaRes.ok) {
          const txt = await metaRes.text();
          return new Response(JSON.stringify({ error: `Drive lookup failed (${metaRes.status}): ${txt}` }), {
            status: metaRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const parents: string[] = (await metaRes.json()).parents ?? [];
        const qs = new URLSearchParams({ addParents: targetId, fields: 'id,parents' });
        if (parents.length) qs.set('removeParents', parents.join(','));
        const patchRes = await fetch(`${GATEWAY}/drive/v3/files/${fileId}?${qs.toString()}`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!patchRes.ok) {
          const txt = await patchRes.text();
          return new Response(JSON.stringify({ error: `Drive move failed (${patchRes.status}): ${txt}` }), {
            status: patchRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
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
    const uploadedBy = String(form.get('uploadedBy') ?? '').trim();

    if (!file) return new Response(JSON.stringify({ error: 'file is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!school) return new Response(JSON.stringify({ error: 'school is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!className) return new Response(JSON.stringify({ error: 'className is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const result = await pushToDrive(file, school, className, uploadedBy);
    return new Response(JSON.stringify({ ok: true, file: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
