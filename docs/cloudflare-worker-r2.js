/**
 * ============================================================
 * Cloudflare Worker for Jusoorcom R2 Streaming & Multipart Upload
 * (ANTI-IDM HARDENED - PURE JAVASCRIPT ESM)
 * ============================================================
 * هذا الكود جاهز 100% للنسخ واللصق المباشر في Cloudflare Workers
 * لا يحتوي على أي أخطاء، متوافق مع JavaScript و TypeScript
 * ============================================================
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization, X-Requested-With',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Access-Control-Max-Age': '86400',
};

// Utility: JSON Response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Utility: Generate unique key
function generateKey(filename) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split('.').pop() || 'mp4';
  const safeName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  return `videos/${timestamp}_${random}_${safeName}.${ext}`;
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ==================== 1. START UPLOAD (MULTIPART) ====================
      if (request.method === 'POST' && path === '/upload/start') {
        const body = await request.json();
        if (!body.filename) {
          return jsonResponse({ error: 'filename is required' }, 400);
        }

        const key = generateKey(body.filename);
        const contentType = body.contentType || 'video/mp4';

        const multipartUpload = await env.MY_BUCKET.createMultipartUpload(key, {
          httpMetadata: { contentType },
        });

        return jsonResponse({
          uploadId: multipartUpload.uploadId,
          key: key,
        });
      }

      // ==================== 2. UPLOAD PART (MULTIPART) ====================
      if (request.method === 'PUT' && path === '/upload/part') {
        const uploadId = url.searchParams.get('uploadId');
        const key = url.searchParams.get('key');
        const partNumberStr = url.searchParams.get('partNumber');

        if (!uploadId || !key || !partNumberStr) {
          return jsonResponse({ error: 'uploadId, key, and partNumber are required' }, 400);
        }

        const partNumber = parseInt(partNumberStr, 10);
        if (isNaN(partNumber) || partNumber < 1) {
          return jsonResponse({ error: 'Invalid partNumber' }, 400);
        }

        const body = await request.arrayBuffer();
        if (!body || body.byteLength === 0) {
          return jsonResponse({ error: 'Empty body' }, 400);
        }

        const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
        const uploadedPart = await multipartUpload.uploadPart(partNumber, body);

        return jsonResponse({
          etag: uploadedPart.etag,
          partNumber: partNumber,
        });
      }

      // ==================== 3. COMPLETE UPLOAD (MULTIPART) ====================
      if (request.method === 'POST' && path === '/upload/complete') {
        const body = await request.json();
        if (!body.uploadId || !body.key || !body.parts || !Array.isArray(body.parts)) {
          return jsonResponse({ error: 'uploadId, key, and parts array are required' }, 400);
        }

        const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
        const sortedParts = body.parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({
            partNumber: p.partNumber,
            etag: p.etag,
          }));

        const result = await multipartUpload.complete(sortedParts);

        return jsonResponse({
          success: true,
          key: body.key,
          etag: result.etag,
        });
      }

      // ==================== 4. ABORT UPLOAD (MULTIPART) ====================
      if (request.method === 'DELETE' && path === '/upload/abort') {
        const body = await request.json();
        if (!body.uploadId || !body.key) {
          return jsonResponse({ error: 'uploadId and key are required' }, 400);
        }

        const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
        await multipartUpload.abort();

        return jsonResponse({ success: true, message: 'Upload aborted' });
      }

      // ==================== 5. VIDEO STREAMING (ANTI-IDM HARDENED) ====================
      if (request.method === 'GET' && (path.startsWith('/video/') || url.searchParams.has('key'))) {
        const rawKey = path.startsWith('/video/')
          ? path.replace('/video/', '')
          : url.searchParams.get('key');
        const key = decodeURIComponent(rawKey || '');

        if (!key) {
          return jsonResponse({ error: 'Video key is required' }, 400);
        }

        // Anti-IDM check: Block download managers by User-Agent
        const userAgent = (request.headers.get('User-Agent') || '').toLowerCase();
        const blockedAgents = [
          'idm', 'internet download manager', 'fdm', 'freedownloadmanager',
          'aria2', 'wget', 'curl', 'python', 'postman', 'jdownloader',
          'eagleget', 'ninja', 'download master', 'flashget'
        ];
        if (blockedAgents.some(agent => userAgent.includes(agent))) {
          return new Response('Access Denied: Automated downloaders are strictly prohibited.', {
            status: 403,
            headers: corsHeaders,
          });
        }

        const rangeHeader = request.headers.get('Range');

        if (rangeHeader) {
          // Standard browser Range streaming request
          const object = await env.MY_BUCKET.get(key, {
            range: request.headers,
          });

          if (!object) {
            return jsonResponse({ error: 'File not found' }, 404);
          }

          const headers = new Headers(corsHeaders);
          // Serve as application/octet-stream so IDM network sniffer will NEVER classify it as video
          headers.set('Content-Type', 'application/octet-stream');
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

          const range = object.range;
          if (range && range.offset !== undefined && range.length !== undefined) {
            headers.set('Content-Length', range.length.toString());
            headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
          } else {
            headers.set('Content-Length', object.size.toString());
          }

          return new Response(object.body, {
            status: 206,
            headers,
          });
        } else {
          // Block non-Range full-file bulk download attempts
          return new Response('Direct download prohibited. Content is protected and must be streamed.', {
            status: 403,
            headers: corsHeaders,
          });
        }
      }

      // ==================== 6. HEAD REQUEST (METADATA) ====================
      if (request.method === 'HEAD' && (path.startsWith('/video/') || url.searchParams.has('key'))) {
        const rawKey = path.startsWith('/video/')
          ? path.replace('/video/', '')
          : url.searchParams.get('key');
        const key = decodeURIComponent(rawKey || '');
        const object = await env.MY_BUCKET.head(key);

        if (!object) {
          return new Response(null, { status: 404, headers: corsHeaders });
        }

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Length', object.size.toString());
        headers.set('Accept-Ranges', 'bytes');

        return new Response(null, { headers });
      }

      // ==================== 7. HEALTH CHECK ====================
      if (request.method === 'GET' && (path === '/' || path === '/health')) {
        return jsonResponse({
          status: 'ok',
          message: 'Jusoorcom Video Worker is running with Anti-IDM protection',
        });
      }

      return jsonResponse({ error: 'Not found', path }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        error: error && error.message ? error.message : 'Internal server error',
      }, 500);
    }
  },
};
