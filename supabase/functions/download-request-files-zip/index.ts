import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user and check if admin
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request info
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from("custom_course_requests")
      .select("title")
      .eq("id", requestId)
      .single();

    if (requestError) {
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request files
    const { data: files, error: filesError } = await supabaseAdmin
      .from("request_files")
      .select("*")
      .eq("request_id", requestId);

    if (filesError || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files found for this request" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create ZIP file
    const zip = new JSZip();

    for (const file of files) {
      try {
        // Extract file path from URL
        let filePath = file.file_url;
        const storageUrlPattern = /\/storage\/v1\/object\/(?:public|sign)\/request-files\/(.+)/;
        const match = filePath.match(storageUrlPattern);
        if (match) {
          filePath = match[1];
        }

        // Download file content
        const { data: fileData, error: downloadError } = await supabaseAdmin
          .storage
          .from("request-files")
          .download(filePath);

        if (downloadError || !fileData) {
          console.error(`Failed to download file ${file.id}:`, downloadError);
          continue;
        }

        // Add file to ZIP
        const arrayBuffer = await fileData.arrayBuffer();
        zip.file(file.file_name, arrayBuffer);
      } catch (fileError) {
        console.error(`Error processing file ${file.id}:`, fileError);
      }
    }

    // Generate ZIP
    const zipContent = await zip.generateAsync({ type: "blob" });

    // Create safe filename
    const safeTitle = requestData.title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '_').substring(0, 50);
    const zipFileName = `${safeTitle}_files.zip`;

    return new Response(zipContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zipFileName)}"`,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
