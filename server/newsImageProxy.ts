import type { Request, Response } from 'express';

const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|\[::1\])/i;

function allowedUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || BLOCKED_HOSTS.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function extractMetaImage(html: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const wanted = new Set(['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);
  for (const tag of tags) {
    const property = decodeHtml(tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    if (!wanted.has(property)) continue;
    const content = decodeHtml(tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] || '').trim();
    if (content) return content;
  }
  const imageSrc = html.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*image_src[^"']*["'][^>]*\bhref\s*=\s*["']([^"']+)["']/i)
    || html.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\brel\s*=\s*["'][^"']*image_src[^"']*["']/i);
  return decodeHtml(imageSrc?.[1] || '').trim();
}

async function fetchResource(url: URL, accept = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,text/html;q=0.8,*/*;q=0.5') {
  return fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArthaBenchPro/1.0; +https://artha-bench-pro.vercel.app)',
      Accept: accept,
    },
    signal: AbortSignal.timeout(7_000),
  });
}

export async function resolvePublisherImage(sourceUrl: string) {
  const source = allowedUrl(sourceUrl);
  if (!source) return null;
  try {
    const response = await fetchResource(source, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) return response.url;
    const html = await response.text();
    const candidate = allowedUrl(extractMetaImage(html));
    if (!candidate) return null;
    const imageResponse = await fetchResource(candidate);
    if (!imageResponse.ok || !(imageResponse.headers.get('content-type') || '').startsWith('image/')) return null;
    return candidate.toString();
  } catch {
    return null;
  }
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
      const imageUrl = allowedUrl(extractMetaImage(html));
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
