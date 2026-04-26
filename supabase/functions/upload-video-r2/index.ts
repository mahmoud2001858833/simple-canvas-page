import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLOUDFLARE_WORKER_URL = 'https://nameless-smoke-ab0f.jowmahmoud6.workers.dev';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
};

// Verify user authentication and role
async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { error: 'Authorization required', status: 401 };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'instructor'].includes(roleData.role)) {
    return { error: 'Only admins and instructors can upload videos', status: 403 };
  }

  return { user, supabase };
}

// Generate unique key for video
function generateVideoKey(filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split('.').pop() || 'mp4';
  const safeName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  return `videos/${timestamp}_${random}_${safeName}.${ext}`;
}

// In-memory storage for multipart uploads (will reset on function cold start)
const uploadSessions = new Map<string, {
  key: string;
  parts: Array<ArrayBuffer>;
  filename: string;
  contentType: string;
}>();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // Verify authentication for all actions
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== START MULTIPART UPLOAD ====================
    if (req.method === 'POST' && action === 'start') {
      const body = await req.json();
      const filename = body.filename;
      const contentType = body.contentType || 'video/mp4';
      
      console.log(`[upload-video-r2] Starting multipart upload for: ${filename}`);

      // Generate unique upload ID and key
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const key = generateVideoKey(filename);

      // Store session
      uploadSessions.set(uploadId, {
        key,
        parts: [],
        filename,
        contentType,
      });

      console.log(`[upload-video-r2] Upload session created: uploadId=${uploadId}, key=${key}`);

      return new Response(
        JSON.stringify({ uploadId, key }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== UPLOAD PART ====================
    if (req.method === 'PUT' && action === 'part') {
      const uploadId = url.searchParams.get('uploadId');
      const key = url.searchParams.get('key');
      const partNumber = parseInt(url.searchParams.get('partNumber') || '0', 10);

      if (!uploadId || !key || partNumber < 1) {
        return new Response(
          JSON.stringify({ error: 'uploadId, key, and partNumber are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = uploadSessions.get(uploadId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Upload session not found or expired' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get binary body
      const body = await req.arrayBuffer();
      console.log(`[upload-video-r2] Received part ${partNumber} for ${key}, size: ${(body.byteLength / 1024 / 1024).toFixed(2)} MB`);

      // Store part (partNumber is 1-indexed, array is 0-indexed)
      session.parts[partNumber - 1] = body;

      // Generate a fake etag for compatibility
      const etag = `part-${partNumber}-${Date.now()}`;

      return new Response(
        JSON.stringify({ etag, partNumber }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== COMPLETE UPLOAD ====================
    if (req.method === 'POST' && action === 'complete') {
      const body = await req.json();
      const uploadId = body.uploadId;
      const key = body.key;

      if (!uploadId || !key) {
        return new Response(
          JSON.stringify({ error: 'uploadId and key are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = uploadSessions.get(uploadId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Upload session not found or expired' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[upload-video-r2] Completing upload for: ${key}, parts: ${session.parts.length}`);

      // Combine all parts into a single blob
      const combinedParts = session.parts.filter(p => p); // Remove any undefined
      const totalSize = combinedParts.reduce((acc, p) => acc + p.byteLength, 0);
      console.log(`[upload-video-r2] Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

      // Create combined buffer
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const part of combinedParts) {
        combined.set(new Uint8Array(part), offset);
        offset += part.byteLength;
      }

      // Upload to Cloudflare Worker using /upload endpoint with single file
      const formData = new FormData();
      const blob = new Blob([combined], { type: session.contentType });
      formData.append('file', blob, session.filename);

      console.log(`[upload-video-r2] Sending combined file to Cloudflare Worker...`);

      const response = await fetch(`${CLOUDFLARE_WORKER_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      // Clean up session
      uploadSessions.delete(uploadId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[upload-video-r2] Cloudflare upload failed: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Upload failed: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      console.log(`[upload-video-r2] Upload completed:`, result);

      return new Response(
        JSON.stringify({ success: true, key: result.key || key }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== ABORT UPLOAD ====================
    if (req.method === 'DELETE' && action === 'abort') {
      const body = await req.json();
      const uploadId = body.uploadId;

      if (uploadId && uploadSessions.has(uploadId)) {
        uploadSessions.delete(uploadId);
        console.log(`[upload-video-r2] Upload aborted: ${uploadId}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Upload aborted' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: start, part, complete, or abort' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Upload failed';
    console.error('[upload-video-r2] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
