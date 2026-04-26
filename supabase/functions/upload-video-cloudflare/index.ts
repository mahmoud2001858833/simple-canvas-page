import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
};

const CLOUDFLARE_WORKER_URL = 'https://ancient-king-9e42.mhawish-alaa.workers.dev';

// Verify user authentication and authorization
async function verifyAuth(req: Request): Promise<{ user: any; supabase: any } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('[upload-video-cloudflare] No auth header');
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('[upload-video-cloudflare] Auth error:', authError);
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check user role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'instructor'].includes(roleData.role)) {
    console.error('[upload-video-cloudflare] Unauthorized role:', roleData?.role);
    return new Response(
      JSON.stringify({ error: 'Only admins and instructors can upload videos' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[upload-video-cloudflare] User authorized:', user.id, 'Role:', roleData.role);
  return { user, supabase };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'direct';

    console.log('[upload-video-cloudflare] Request received, action:', action);

    // Verify authentication
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    let workerEndpoint: string;
    let workerResponse: Response;

    switch (action) {
      case 'start': {
        // Start multipart upload
        const body = await req.json();
        const filename = body.filename || 'video.mp4';
        
        console.log('[upload-video-cloudflare] Starting multipart upload for:', filename);
        
        workerResponse = await fetch(`${CLOUDFLARE_WORKER_URL}/upload/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }),
        });
        break;
      }

      case 'part': {
        // Upload a part - Worker الجديد يستخدم PUT مع Query Parameters
        const formData = await req.formData();
        const file = formData.get('file') as Blob;
        const uploadId = formData.get('uploadId') as string;
        const partNumber = formData.get('partNumber') as string;
        const key = formData.get('key') as string;

        console.log('[upload-video-cloudflare] Uploading part:', partNumber, 'uploadId:', uploadId, 'key:', key);

        // إرسال البيانات كـ ArrayBuffer مع Query Parameters كما يتوقع الـ Worker الجديد
        const fileBuffer = await file.arrayBuffer();
        
        workerResponse = await fetch(
          `${CLOUDFLARE_WORKER_URL}/upload/part?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`,
          {
            method: 'PUT',
            body: fileBuffer,
            headers: {
              'Content-Type': 'application/octet-stream',
            },
          }
        );
        break;
      }

      case 'complete': {
        // Complete multipart upload
        const body = await req.json();
        
        console.log('[upload-video-cloudflare] Completing upload:', body.uploadId);
        
        workerResponse = await fetch(`${CLOUDFLARE_WORKER_URL}/upload/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        break;
      }

      case 'abort': {
        // Abort multipart upload
        const body = await req.json();
        
        console.log('[upload-video-cloudflare] Aborting upload:', body.uploadId);
        
        workerResponse = await fetch(`${CLOUDFLARE_WORKER_URL}/upload/abort`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        break;
      }

      case 'direct':
      default: {
        // Direct upload for small files
        const formData = await req.formData();
        const file = formData.get('file');

        console.log('[upload-video-cloudflare] Direct upload, file size:', 
          file instanceof Blob ? file.size : 'unknown');

        workerResponse = await fetch(`${CLOUDFLARE_WORKER_URL}/upload`, {
          method: 'POST',
          body: formData,
        });
        break;
      }
    }

    const responseText = await workerResponse.text();
    console.log('[upload-video-cloudflare] Worker response:', workerResponse.status, responseText.substring(0, 200));

    return new Response(responseText, {
      status: workerResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[upload-video-cloudflare] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
