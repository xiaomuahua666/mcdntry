export const runtime = 'nodejs'

import { neon } from '@neondatabase/serverless'

function encodeRFC5987(str: string) {
  return encodeURIComponent(str).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return new Response('Server misconfigured: DATABASE_URL missing', {
      status: 500,
    })
  }

  const sql = neon(databaseUrl)
  const { path } = await ctx.params

  // Join all path segments to form the id
  const id = (path ?? []).map((s) => decodeURIComponent(s)).filter(Boolean).join('/')
  if (!id) return new Response('Not Found', { status: 404 })

  // Query the data table for this id
  const rows = await sql`SELECT blob FROM data WHERE id = ${id} LIMIT 1`

  if (rows.length === 0) {
    return new Response('Not Found', { status: 404 })
  }

  const blobUrl = rows[0].blob
  if (!blobUrl || !blobUrl.startsWith('https://')) {
    return new Response('Invalid upstream URL', { status: 502 })
  }

  // Proxy-fetch the blob URL
  const upstream = await fetch(blobUrl, {
    headers: { 'user-agent': 'Nextjs-Blob-Proxy' },
  })

  if (!upstream.ok || !upstream.body) {
    return Response.redirect(blobUrl, 302)
  }

  const headers = new Headers()
  headers.set(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/octet-stream',
  )

  const clen = upstream.headers.get('content-length')
  if (clen) headers.set('Content-Length', clen)

  headers.set(
    'Cache-Control',
    'public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
  )

  // Use the last segment of the id as the filename hint
  const filename = id.split('/').pop() ?? id
  headers.set(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeRFC5987(filename)}`,
  )

  return new Response(upstream.body, { status: 200, headers })
}
