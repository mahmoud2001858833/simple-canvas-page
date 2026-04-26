/**
 * ============================================================
 * Cloudflare Worker for R2 Video Upload with CORS Support
 * ============================================================
 * 
 * هذا الكود يجب نسخه ولصقه في Cloudflare Worker Dashboard
 * 
 * إعداد R2 Binding:
 * 1. اذهب إلى Workers & Pages → Worker الخاص بك → Settings → Variables
 * 2. في قسم R2 Bucket Bindings، أضف:
 *    - Variable name: MY_BUCKET
 *    - R2 Bucket: اختر bucket الخاص بك
 * 
 * Endpoint:
 * - POST /upload - رفع ملف أو جزء من ملف
 * - GET /video/{key} - عرض الفيديو مع دعم streaming
 * 
 * حقول الـ FormData:
 * - file: الملف أو الجزء
 * - chunkIndex: رقم الجزء (0, 1, 2, ...)
 * - totalChunks: العدد الكلي للأجزاء
 * - uploadId: معرف فريد لعملية الرفع
 * ============================================================
 */

interface Env {
  MY_BUCKET: R2Bucket;
}

// In-memory storage for chunks (resets on worker restart)
const uploadSessions = new Map<string, {
  chunks: Map<number, ArrayBuffer>;
  filename: string;
  totalChunks: number;
  contentType: string;
}>();

// CORS headers - يسمح بالوصول من أي مصدر
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization, X-Requested-With',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Access-Control-Max-Age': '86400',
};

// Utility: JSON Response with CORS
function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Utility: Generate unique key for video
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

// Get content type from filename
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'm4v': 'video/x-m4v',
  };
  return types[ext || ''] || 'video/mp4';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ==================== UPLOAD ENDPOINT ====================
      if (request.method === 'POST' && path === '/upload') {
        const formData = await request.formData();
        
        const file = formData.get('file') as File | null;
        const chunkIndexStr = formData.get('chunkIndex') as string | null;
        const totalChunksStr = formData.get('totalChunks') as string | null;
        const uploadId = formData.get('uploadId') as string | null;

        if (!file) {
          return jsonResponse({ error: 'No file provided' }, 400);
        }

        const chunkIndex = parseInt(chunkIndexStr || '0', 10);
        const totalChunks = parseInt(totalChunksStr || '1', 10);
        
        if (!uploadId) {
          return jsonResponse({ error: 'uploadId is required' }, 400);
        }

        const filename = file.name || 'video.mp4';
        const contentType = getContentType(filename);

        console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId}`);

        // Single chunk upload (direct upload for small files)
        if (totalChunks === 1) {
          const key = generateKey(filename);
          const arrayBuffer = await file.arrayBuffer();
          
          console.log(`📤 Direct upload: ${key} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

          await env.MY_BUCKET.put(key, arrayBuffer, {
            httpMetadata: { contentType },
          });

          console.log(`✅ Upload complete: ${key}`);

          return jsonResponse({
            success: true,
            key: key,
          });
        }

        // Multi-chunk upload
        let session = uploadSessions.get(uploadId);
        
        if (!session) {
          session = {
            chunks: new Map(),
            filename,
            totalChunks,
            contentType,
          };
          uploadSessions.set(uploadId, session);
          console.log(`🚀 New upload session: ${uploadId}, expecting ${totalChunks} chunks`);
        }

        // Store the chunk
        const chunkData = await file.arrayBuffer();
        session.chunks.set(chunkIndex, chunkData);

        console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} stored (${(chunkData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

        // Check if all chunks received
        if (session.chunks.size === totalChunks) {
          console.log(`🔧 All chunks received, combining...`);

          // Sort and combine chunks
          const sortedChunks: ArrayBuffer[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const chunk = session.chunks.get(i);
            if (!chunk) {
              return jsonResponse({ error: `Missing chunk ${i}` }, 400);
            }
            sortedChunks.push(chunk);
          }

          // Calculate total size
          const totalSize = sortedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
          
          // Combine into single buffer
          const combined = new Uint8Array(totalSize);
          let offset = 0;
          for (const chunk of sortedChunks) {
            combined.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          const key = generateKey(session.filename);
          
          console.log(`📤 Uploading combined file: ${key} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

          await env.MY_BUCKET.put(key, combined.buffer, {
            httpMetadata: { contentType: session.contentType },
          });

          // Cleanup session
          uploadSessions.delete(uploadId);

          console.log(`✅ Upload complete: ${key}`);

          return jsonResponse({
            success: true,
            key: key,
          });
        }

        // Not all chunks yet, return progress
        return jsonResponse({
          success: true,
          chunksReceived: session.chunks.size,
          totalChunks: totalChunks,
          message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
        });
      }

      // ==================== VIDEO STREAMING ENDPOINT ====================
      if (request.method === 'GET' && path.startsWith('/video/')) {
        const key = decodeURIComponent(path.replace('/video/', ''));
        
        if (!key) {
          return jsonResponse({ error: 'Video key is required' }, 400);
        }

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
            status: 206, // Partial Content
            headers,
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
      if (request.method === 'HEAD' && path.startsWith('/video/')) {
        const key = decodeURIComponent(path.replace('/video/', ''));
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
          message: 'R2 Video Upload Worker is running',
          endpoints: {
            upload: 'POST /upload (multipart/form-data)',
            video: 'GET /video/{key}',
          },
          activeSessions: uploadSessions.size,
        });
      }

      return jsonResponse({ error: 'Not found', path }, 404);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Worker error:', errorMessage);
      return jsonResponse({
        error: errorMessage,
      }, 500);
    }
  },
};
