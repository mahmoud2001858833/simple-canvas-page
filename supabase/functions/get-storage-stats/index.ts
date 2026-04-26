import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify their role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user and verify they're an admin
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client to access storage.objects
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get storage stats using raw SQL query via RPC or direct table access
    // Since we can't use raw SQL, we'll query each bucket separately
    const bucketNames = ['course-videos', 'request-files', 'chat-images'];
    const bucketStats = [];

    for (const bucketName of bucketNames) {
      const { data: files, error: filesError } = await adminClient
        .storage
        .from(bucketName)
        .list('', { limit: 10000 });

      if (filesError) {
        console.error(`Error fetching files from ${bucketName}:`, filesError);
        bucketStats.push({
          id: bucketName,
          name: bucketName,
          used: 0,
          files_count: 0,
          error: filesError.message
        });
        continue;
      }

      // Calculate total size - need to get metadata for each file
      let totalSize = 0;
      let fileCount = 0;

      // For folders, we need to recursively list
      const getAllFiles = async (path: string = ''): Promise<{ size: number; count: number }> => {
        const { data: items, error } = await adminClient
          .storage
          .from(bucketName)
          .list(path, { limit: 10000 });

        if (error || !items) return { size: 0, count: 0 };

        let size = 0;
        let count = 0;

        for (const item of items) {
          if (item.id) {
            // It's a file
            const metadata = item.metadata as { size?: number } | null;
            size += metadata?.size || 0;
            count += 1;
          } else if (item.name) {
            // It's a folder, recurse
            const subPath = path ? `${path}/${item.name}` : item.name;
            const subResult = await getAllFiles(subPath);
            size += subResult.size;
            count += subResult.count;
          }
        }

        return { size, count };
      };

      const result = await getAllFiles();
      totalSize = result.size;
      fileCount = result.count;

      bucketStats.push({
        id: bucketName,
        name: getBucketDisplayName(bucketName),
        name_ar: getBucketDisplayNameAr(bucketName),
        used: totalSize,
        files_count: fileCount
      });
    }

    const totalUsed = bucketStats.reduce((sum, b) => sum + (b.used || 0), 0);

    // Storage limits based on plan (default to free tier)
    const storageLimits = {
      free: 1 * 1024 * 1024 * 1024,      // 1 GB
      pro: 8 * 1024 * 1024 * 1024,       // 8 GB
      team: 100 * 1024 * 1024 * 1024,    // 100 GB
      enterprise: 1024 * 1024 * 1024 * 1024 // 1 TB (effectively unlimited)
    };

    // Default to free plan limit
    const storageLimit = storageLimits.free;

    console.log('Storage stats calculated:', { totalUsed, buckets: bucketStats.length });

    return new Response(
      JSON.stringify({
        buckets: bucketStats,
        total_used: totalUsed,
        storage_limit: storageLimit,
        usage_percent: Math.round((totalUsed / storageLimit) * 100)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-storage-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getBucketDisplayName(bucketId: string): string {
  const names: Record<string, string> = {
    'course-videos': 'Course Videos',
    'request-files': 'Request Files',
    'chat-images': 'Chat Images'
  };
  return names[bucketId] || bucketId;
}

function getBucketDisplayNameAr(bucketId: string): string {
  const names: Record<string, string> = {
    'course-videos': 'فيديوهات الكورسات',
    'request-files': 'ملفات الطلبات',
    'chat-images': 'صور المحادثات'
  };
  return names[bucketId] || bucketId;
}
