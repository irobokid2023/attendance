// Streams a single Drive file's bytes through the connector gateway so the app
// can render image previews without exposing Drive credentials to the browser.
// Only authenticated users may call it. Videos are NOT streamed here
// (too heavy) — the UI embeds Drive's own /preview player for those.
//
// Two modes:
//   { fileId }                 -> full image bytes (max 25 MB)
//   { fileId, thumb: true }    -> small Drive thumbnail (fast, few KB)
// Drive rate limits (429 / 403 rateLimitExceeded) are retried with backoff and
// surfaced as a 429 with Retry-After so the client can back off gracefully.
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

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRateLimited = (res: Response) =>
  res.status === 429 || res.status === 403 || res.status === 500 || res.status === 502 ||
  res.status === 503 || res.status === 504;

// Fetch with exponential backoff on Drive rate limits / transient errors.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (i === attempts - 1) throw e;
      await sleep(300 * 2 ** i + Math.random() * 200);
      continue;
    }
    if (res.ok || !isRateLimited(res)) return res;
    lastRes = res;
    const body = await res.clone().text().catch(() => '');
    // 403 is only retryable when it is a rate/quota error.
    if (res.status === 403 && !/rateLimit|userRateLimit|quotaExceeded|backendError/i.test(body)) {
      return res;
    }
    if (i === attempts - 1) break;
    const retryAfter = Number(res.headers.get('Retry-After') ?? 0);
    const wait = retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** i + Math.random() * 300;
    console.warn(`Drive ${res.status} — retrying in ${Math.round(wait)}ms (attempt ${i + 1}/${attempts})`);
    await sleep(Math.min(wait, 5000));
  }
  return lastRes!;
}

// Small in-instance metadata cache: avoids a metadata round-trip per thumbnail.
const metaCache = new Map<string, { at: number; meta: any }>();
const META_TTL = 10 * 60_000;

async function getMeta(fileId: string) {
  const hit = metaCache.get(fileId);
  if (hit && Date.now() - hit.at < META_TTL) return hit.meta;
  const res = await fetchWithRetry(
    `${GATEWAY}/drive/v3/files/${fileId}?fields=id,name,mimeType,size,thumbnailLink`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const txt = await res.text();
    const err: any = new Error(txt || `Drive metadata failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const meta = await res.json();
  metaCache.set(fileId, { at: Date.now(), meta });
  return meta;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
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

    const body = await req.json().catch(() => ({}));
    const fileId = String((body as any)?.fileId ?? '').trim();
    const wantThumb = !!(body as any)?.thumb;
    const thumbSize = Math.min(Math.max(Number((body as any)?.size ?? 320), 64), 1024);
    if (!fileId) return json({ error: 'fileId is required' }, 400);

    let meta: any;
    try {
      meta = await getMeta(fileId);
    } catch (e) {
      const status = (e as any)?.status ?? 502;
      console.error(`Drive metadata failed [${status}]: ${(e as any)?.message}`);
      if (status === 429 || status === 403) {
        return json({ error: 'Drive is rate limiting requests, please retry' }, 429, { 'Retry-After': '3' });
      }
      return json({ error: 'Drive metadata failed', status }, status === 404 ? 404 : 502);
    }

    const mime: string = meta.mimeType ?? '';
    const size = Number(meta.size ?? 0);
    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');

    // Thumbnails: cheap and fast; work for videos too (poster frame).
    if (wantThumb) {
      const link: string = meta.thumbnailLink ?? '';
      if (!link) return json({ error: 'No thumbnail available' }, 404);
      const sized = link.replace(/=s\d+(-c)?$/, `=s${thumbSize}`);
      const thumbRes = await fetchWithRetry(sized, { headers: authHeaders() });
      if (!thumbRes.ok) {
        // Thumbnail URLs are sometimes publicly fetchable without auth headers.
        const plain = await fetchWithRetry(sized, {});
        if (!plain.ok) {
          console.error(`Drive thumbnail failed [${thumbRes.status}]`);
          if (thumbRes.status === 429 || thumbRes.status === 403) {
            return json({ error: 'Drive is rate limiting requests, please retry' }, 429, { 'Retry-After': '3' });
          }
          // Fall back to full bytes for small images, otherwise report failure.
          if (!(isImage && size > 0 && size <= 2 * 1024 * 1024)) {
            return json({ error: 'Thumbnail unavailable' }, 502);
          }
        } else {
          return new Response(new Uint8Array(await plain.arrayBuffer()), {
            headers: {
              ...corsHeaders,
              'Content-Type': plain.headers.get('Content-Type') ?? 'image/jpeg',
              'Cache-Control': 'private, max-age=604800, immutable',
            },
          });
        }
      } else {
        return new Response(new Uint8Array(await thumbRes.arrayBuffer()), {
          headers: {
            ...corsHeaders,
            'Content-Type': thumbRes.headers.get('Content-Type') ?? 'image/jpeg',
            'Cache-Control': 'private, max-age=604800, immutable',
          },
        });
      }
    }

    if (!isImage) {
      return json({ error: isVideo ? 'Use the Drive player for videos' : 'Only image previews are supported' }, 415);
    }
    if (size > 25 * 1024 * 1024) return json({ error: 'Image too large to preview' }, 413);

    const fileRes = await fetchWithRetry(`${GATEWAY}/drive/v3/files/${fileId}?alt=media`, { headers: authHeaders() });
    if (!fileRes.ok) {
      const txt = await fileRes.text();
      console.error(`Drive download failed [${fileRes.status}]: ${txt}`);
      if (fileRes.status === 429 || fileRes.status === 403) {
        return json({ error: 'Drive is rate limiting requests, please retry' }, 429, { 'Retry-After': '3' });
      }
      return json({ error: 'Drive download failed', status: fileRes.status }, fileRes.status);
    }
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=604800, immutable',
      },
    });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
