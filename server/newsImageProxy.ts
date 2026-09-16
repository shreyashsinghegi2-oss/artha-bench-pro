import type { Request, Response } from 'express';

const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|\[::1\])/i;

function allowedUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || BLOCKED_HOSTS.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}

function extractMeta(html: string, property: string) {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`, 'i'));
  return match?.[1]?.trim() || '';
}

async function fetchResource(url: URL) {
  return fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArthaBenchPro/1.0; +https://artha-bench-pro.vercel.app)',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,text/html;q=0.8,*/*;q=0.5',
    },
    signal: AbortSignal.timeout(7_000),
  });
}

export async function handleNewsImage(req: Request, res: Response) {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  const source = allowedUrl(raw);
  if (!source) return res.status(400).json({ error: 'Invalid news image URL.' });

  try {
    let response = await fetchResource(source);
    if (!response.ok) return res.status(404).json({ error: 'News resource unavailable.' });
    let contentType = response.headers.get('content-type') || '';

    if (!contentType.startsWith('image/')) {
      const html = await response.text();
      const image = extractMeta(html, 'og:image:secure_url') || extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
      const imageUrl = allowedUrl(image);
      if (!imageUrl) return res.status(404).json({ error: 'Publisher did not expose a usable article image.' });
      response = await fetchResource(imageUrl);
      if (!response.ok) return res.status(404).json({ error: 'Publisher image unavailable.' });
      contentType = response.headers.get('content-type') || '';
    }

    if (!contentType.startsWith('image/')) return res.status(415).json({ error: 'Resolved resource is not an image.' });
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    res.setHeader('Content-Type', contentType.split(';')[0]);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Length', buffer.length.toString());
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('News image proxy failed:', error);
    return res.status(502).json({ error: 'Unable to resolve publisher image.' });
  }
}
