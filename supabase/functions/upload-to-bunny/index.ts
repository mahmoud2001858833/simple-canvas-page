import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[upload-to-bunny] Starting server-side upload process");

    // 1. Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[upload-to-bunny] No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      console.error("[upload-to-bunny] Invalid token:", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[upload-to-bunny] User authenticated:", userData.user.id);

    // 3. Check user role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (roleError || !roleData || !["admin", "instructor"].includes(roleData.role)) {
      console.error("[upload-to-bunny] User not authorized:", roleData?.role);
      return new Response(JSON.stringify({ error: "Forbidden - Admin or Instructor only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[upload-to-bunny] User role verified:", roleData.role);

    // 4. Parse request body (NOT FormData - just JSON with temp file path)
    const { tempFilePath, courseId, lessonId, quality } = await req.json();

    if (!tempFilePath || !courseId || !lessonId) {
      console.error("[upload-to-bunny] Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields: tempFilePath, courseId, lessonId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[upload-to-bunny] Request data:", { tempFilePath, courseId, lessonId, quality });

    // 5. Download file from Supabase temp storage (SERVER-SIDE)
    console.log("[upload-to-bunny] Downloading from temp storage:", tempFilePath);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("temp-uploads")
      .download(tempFilePath);

    if (downloadError || !fileData) {
      console.error("[upload-to-bunny] Failed to download from temp storage:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to read temp file", details: downloadError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[upload-to-bunny] File downloaded, size:", fileData.size, "bytes");

    // 6. Convert to ArrayBuffer
    const fileBuffer = await fileData.arrayBuffer();
    console.log("[upload-to-bunny] Converted to buffer, size:", fileBuffer.byteLength, "bytes");

    // 7. Build Bunny Storage path
    const qualitySuffix = quality && quality !== "default" ? `-${quality}` : "";
    const filePath = `uploads/courses/${courseId}/lesson-${lessonId}${qualitySuffix}.mp4`;

    console.log("[upload-to-bunny] Bunny file path:", filePath);

    // 8. Get Bunny Storage credentials
    const storageHost = Deno.env.get("BUNNY_STORAGE_HOST");
    const storageUsername = Deno.env.get("BUNNY_STORAGE_USERNAME");
    const storagePassword = Deno.env.get("BUNNY_STORAGE_PASSWORD");

    if (!storageHost || !storageUsername || !storagePassword) {
      console.error("[upload-to-bunny] Missing Bunny Storage credentials");
      return new Response(JSON.stringify({ error: "Server configuration error - missing credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Upload to Bunny Storage using PUT with Buffer
    const uploadUrl = `https://${storageHost}/${storageUsername}/${filePath}`;
    console.log("[upload-to-bunny] Uploading to Bunny:", uploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": storagePassword,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    const responseText = await uploadResponse.text();
    console.log("[upload-to-bunny] Bunny response status:", uploadResponse.status);
    console.log("[upload-to-bunny] Bunny response:", responseText);

    if (!uploadResponse.ok) {
      console.error("[upload-to-bunny] Bunny upload failed:", uploadResponse.status, responseText);
      return new Response(JSON.stringify({ 
        error: "Failed to upload to Bunny storage",
        status: uploadResponse.status,
        details: responseText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Delete temp file from Supabase Storage
    console.log("[upload-to-bunny] Deleting temp file:", tempFilePath);
    const { error: deleteError } = await supabase.storage
      .from("temp-uploads")
      .remove([tempFilePath]);

    if (deleteError) {
      console.warn("[upload-to-bunny] Failed to delete temp file (non-critical):", deleteError);
    } else {
      console.log("[upload-to-bunny] Temp file deleted successfully");
    }

    console.log("[upload-to-bunny] Upload complete! Path:", filePath);

    // 11. Return only the file path (not full URL)
    return new Response(JSON.stringify({
      success: true,
      videoPath: filePath,
      message: "Video uploaded successfully via server-side transfer",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[upload-to-bunny] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
