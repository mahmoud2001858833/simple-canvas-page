/**
 * ============================================================
 * Cloudflare Worker for R2 Multipart File Upload
 * ============================================================
 * 
 * هذا الكود يجب نسخه ولصقه في Cloudflare Worker Dashboard
 * Worker Name: alkaser-upload
 * 
 * إعداد R2 Binding:
 * 1. اذهب إلى Workers & Pages → alkaser-upload → Settings → Variables
 * 2. في قسم R2 Bucket Bindings، أضف:
 *    - Variable name: MY_BUCKET
 *    - R2 Bucket: اختر bucket الخاص بك
 * 
 * Endpoints:
 * - POST /upload/start - بدء رفع جديد
 * - PUT /upload/part?uploadId=X&key=Y&partNumber=N - رفع جزء
 * - POST /upload/complete - إكمال الرفع
 * - DELETE /upload/abort - إلغاء الرفع
 * ============================================================
 */

interface Env {
  MY_BUCKET: R2Bucket;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Access-Control-Max-Age': '86400',
};

// Utility: JSON Response
function jsonResponse(data: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Utility: Generate unique key
function generateKey(filename: string): string {
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
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ==================== START UPLOAD ====================
      if (request.method === 'POST' && path === '/upload/start') {
        const body = await request.json() as { filename: string; contentType: string };
        
        if (!body.filename) {
          return jsonResponse({ error: 'filename is required' }, 400);
        }

        const key = generateKey(body.filename);
        const contentType = body.contentType || 'video/mp4';

        // Create multipart upload
        const multipartUpload = await env.MY_BUCKET.createMultipartUpload(key, {
          httpMetadata: { contentType },
        });

        console.log(`🚀 Started multipart upload: ${key}, uploadId: ${multipartUpload.uploadId}`);

        return jsonResponse({
          uploadId: multipartUpload.uploadId,
          key: key,
        });
      }

      // ==================== UPLOAD PART ====================
      if (request.method === 'PUT' && path === '/upload/part') {
        const uploadId = url.searchParams.get('uploadId');
        const key = url.searchParams.get('key');
        const partNumberStr = url.searchParams.get('partNumber');

        if (!uploadId || !key || !partNumberStr) {
          return jsonResponse({ 
            error: 'uploadId, key, and partNumber are required' 
          }, 400);
        }

        const partNumber = parseInt(partNumberStr, 10);
        if (isNaN(partNumber) || partNumber < 1) {
          return jsonResponse({ error: 'Invalid partNumber' }, 400);
        }

        // Get the binary body
        const body = await request.arrayBuffer();
        
        if (!body || body.byteLength === 0) {
          return jsonResponse({ error: 'Empty body' }, 400);
        }

        console.log(`📦 Uploading part ${partNumber} for ${key} (${(body.byteLength / 1024 / 1024).toFixed(2)} MB)`);

        // Resume multipart upload
        const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);

        // Upload the part
        const uploadedPart = await multipartUpload.uploadPart(partNumber, body);

        console.log(`✅ Part ${partNumber} uploaded, etag: ${uploadedPart.etag}`);

        return jsonResponse({
          etag: uploadedPart.etag,
          partNumber: partNumber,
        });
      }

      // ==================== COMPLETE UPLOAD ====================
      if (request.method === 'POST' && path === '/upload/complete') {
        const body = await request.json() as {
          uploadId: string;
          key: string;
          parts: Array<{ partNumber: number; etag: string }>;
        };

        if (!body.uploadId || !body.key || !body.parts || !Array.isArray(body.parts)) {
          return jsonResponse({ 
            error: 'uploadId, key, and parts array are required' 
          }, 400);
        }

        console.log(`🔧 Completing upload: ${body.key} with ${body.parts.length} parts`);

        // Resume and complete
        const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(body.key, body.uploadId);

        // Sort parts by partNumber
        const sortedParts = body.parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({
            partNumber: p.partNumber,
            etag: p.etag,
          }));

        const result = await multipartUpload.complete(sortedParts);

        console.log(`✅ Upload completed: ${body.key}`);

        return jsonResponse({
          success: true,
          key: body.key,
          etag: result.etag,
        });
      }

      // ==================== ABORT UPLOAD ====================
      if (request.method === 'DELETE' && path === '/upload/abort') {
        const body = await request.json() as { uploadId: string; key: string };

        if (!body.uploadId || !body.key) {
          return jsonResponse({ error: 'uploadId and key are required' }, 400);
        }

        const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(body.key, body.uploadId);
        await multipartUpload.abort();

        console.log(`🗑️ Upload aborted: ${body.key}`);

        return jsonResponse({ success: true, message: 'Upload aborted' });
      }

      // ==================== GET FILE (with Range support) ====================
      if (request.method === 'GET' && url.searchParams.has('key')) {
        const key = url.searchParams.get('key')!;
        
        // Check for Range header (for video streaming)
        const rangeHeader = request.headers.get('Range');
        
        if (rangeHeader) {
          // Handle Range request for video streaming
          const object = await env.MY_BUCKET.get(key, {
            range: request.headers,
          });

          if (!object) {
            return jsonResponse({ error: 'File not found' }, 404);
          }

          const headers = new Headers(corsHeaders);
          headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4');
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'public, max-age=31536000');
          
          // Get range info from R2 response
          const range = object.range as { offset: number; length: number } | undefined;
          if (range) {
            headers.set('Content-Length', range.length.toString());
            headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
          } else {
            headers.set('Content-Length', object.size.toString());
          }

          return new Response(object.body, { 
            status: 206,  // Partial Content
            headers 
          });
        } else {
          // Full file request
          const object = await env.MY_BUCKET.get(key);

          if (!object) {
            return jsonResponse({ error: 'File not found' }, 404);
          }

          const headers = new Headers(corsHeaders);
          headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4');
          headers.set('Content-Length', object.size.toString());
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'public, max-age=31536000');

          return new Response(object.body, { headers });
        }
      }

      // ==================== HEAD request for video metadata ====================
      if (request.method === 'HEAD' && url.searchParams.has('key')) {
        const key = url.searchParams.get('key')!;
        const object = await env.MY_BUCKET.head(key);

        if (!object) {
          return new Response(null, { status: 404, headers: corsHeaders });
        }

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4');
        headers.set('Content-Length', object.size.toString());
        headers.set('Accept-Ranges', 'bytes');

        return new Response(null, { headers });
      }

      // ==================== HEALTH CHECK ====================
      if (request.method === 'GET' && (path === '/' || path === '/health')) {
        return jsonResponse({
          status: 'ok',
          message: 'R2 Multipart Upload Worker is running',
          endpoints: {
            start: 'POST /upload/start',
            part: 'PUT /upload/part?uploadId=X&key=Y&partNumber=N',
            complete: 'POST /upload/complete',
            abort: 'DELETE /upload/abort',
          },
        });
      }

      return jsonResponse({ error: 'Not found', path }, 404);

    } catch (error: any) {
      console.error('❌ Worker error:', error);
      return jsonResponse({
        error: error.message || 'Internal server error',
        details: error.stack,
      }, 500);
    }
  },
};
