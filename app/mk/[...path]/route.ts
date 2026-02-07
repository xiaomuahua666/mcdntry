export const runtime = 'nodejs'

type DriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

type DriveFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string | null;
  thumbnailUrl?: string | null;
};

function normalizeMisskeyOrigin(raw: string) {
  return raw.replace(/\/+$/, '').replace(/\/api$/, '');
}

function apiUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}

function encodeRFC5987(str: string) {
  return encodeURIComponent(str)
    .replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function mkPost<T>(
  origin: string,
  token: string,
  path: string,
  body: Record<string, any>,
): Promise<T> {
  const res = await fetch(apiUrl(origin, path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ i: token, ...body }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Misskey API error ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

async function resolveFolderId(origin: string, token: string, segments: string[]) {
  let parentId: string | null = null;

  for (const name of segments) {
    
const list: DriveFolder[] = await mkPost<DriveFolder[]>(
  origin,
  token,
  '/api/drive/folders/find',
  { name, parentId },
);


    const folder = list.find((f) => f.name === name) ?? list[0];
    if (!folder) return null;

    parentId = folder.id;
  }

  return parentId;
}

async function resolveFile(origin: string, token: string, folderId: string | null, name: string) {
  
const list: DriveFile[] = await mkPost<DriveFile[]>(
  origin,
  token,
  '/api/drive/files/find',
  { name, folderId },
);


  const file = list.find((f) => f.name === name) ?? list[0];
  return file ?? null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const mkApi = process.env.MK_API;
  const mkTk = process.env.MK_TK;

  if (!mkApi || !mkTk) {
    return new Response('Server misconfigured: MK_API/MK_TK missing', { status: 500 });
  }

  const origin = normalizeMisskeyOrigin(mkApi);
  const { path } = await ctx.params;

  const parts = (path ?? []).map((s) => decodeURIComponent(s)).filter(Boolean);
  if (parts.length === 0) return new Response('Not Found', { status: 404 });

  const filename = parts[parts.length - 1];
  const folderSegs = parts.slice(0, -1);

  const folderId = await resolveFolderId(origin, mkTk, folderSegs);
  if (folderSegs.length > 0 && folderId === null) {
    return new Response('Not Found', { status: 404 });
  }

  const file = await resolveFile(origin, mkTk, folderId, filename);
  if (!file) return new Response('Not Found', { status: 404 });

  const url = file.url;
  if (!url) {
    return new Response('Upstream file url missing', { status: 502 });
  }

  const upstream = await fetch(url, {
    headers: { 'user-agent': 'Nextjs-Misskey-Drive-Proxy' },
  });

  if (!upstream.ok || !upstream.body) {
    return Response.redirect(url, 302);
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') ?? file.type ?? 'application/octet-stream');

  const clen = upstream.headers.get('content-length');
  if (clen) headers.set('Content-Length', clen);

  headers.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');

  headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeRFC5987(filename)}`);

  return new Response(upstream.body, { status: 200, headers });
}
