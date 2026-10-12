/**
 * Video Stream URL Utility
 * Obfuscates video keys into opaque base64url stream tokens
 * Completely eliminates .mp4, media extensions, and direct video paths to prevent IDM detection
 */

export const CLOUDFLARE_WORKER_URL = 'https://ancient-king-9e42.mhawish-alaa.workers.dev';

/**
 * Encodes a video key into a URL-safe opaque token without any file extension (.mp4)
 */
export function encodeStreamToken(rawKey: string): string {
  if (!rawKey) return '';
  const cleanKey = rawKey.replace(/^\/+/, '');
  try {
    const encoded = btoa(encodeURIComponent(cleanKey));
    // URL-safe base64: replace + with -, / with _, remove trailing =
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return encodeURIComponent(cleanKey);
  }
}

/**
 * Decodes a stream token back to the original video key
 */
export function decodeStreamToken(token: string): string {
  if (!token) return '';
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    return decodeURIComponent(atob(b64));
  } catch {
    return decodeURIComponent(token);
  }
}

/**
 * Builds the hardened, obfuscated streaming URL
 * URL pattern: /stream/{base64Token} (strictly NO .mp4 in URL)
 */
export function getProtectedStreamUrl(videoKey: string | null | undefined): string | null {
  if (!videoKey) return null;

  // External video links (like YouTube or external URLs)
  if (videoKey.startsWith('http://') || videoKey.startsWith('https://')) {
    // If it points to our Cloudflare Worker, normalize it into the hardened /stream/ endpoint
    if (videoKey.includes('workers.dev')) {
      const match = videoKey.match(/\/(?:video|stream)\/(.+?)(\?|$)/);
      if (match && match[1]) {
        const extracted = decodeStreamToken(match[1]);
        const finalKey = extracted.startsWith('videos/') ? extracted : `videos/${extracted.replace(/^\/+/, '')}`;
        return `${CLOUDFLARE_WORKER_URL}/stream/${encodeStreamToken(finalKey)}`;
      }
    }
    return videoKey;
  }

  // Cloudflare R2 key
  const cleanKey = videoKey.replace(/^\/+/, '');
  const finalKey = cleanKey.startsWith('videos/') ? cleanKey : `videos/${cleanKey}`;
  const token = encodeStreamToken(finalKey);

  return `${CLOUDFLARE_WORKER_URL}/stream/${token}`;
}
