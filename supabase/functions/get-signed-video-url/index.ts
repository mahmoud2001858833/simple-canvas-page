import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    // Admin client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    const { lessonId } = await req.json();

    if (!lessonId) {
      return new Response(
        JSON.stringify({ error: "Lesson ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get lesson details
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("*, course:courses(*)")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: "Lesson not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if lesson has video
    if (!lesson.video_url) {
      return new Response(
        JSON.stringify({ error: "No video available for this lesson" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const isAdminOrInstructor = userRole?.role === "admin" || userRole?.role === "instructor";
    
    // If admin or instructor, allow access
    if (!isAdminOrInstructor) {
      // Check if lesson is preview
      if (!lesson.is_preview) {
        // Verify paid + active access via the central authorization function
        const { data: hasAccess, error: accessError } = await supabaseAdmin.rpc(
          "user_has_course_access",
          { _user_id: userId, _course_id: lesson.course_id },
        );

        if (accessError) {
          console.error("Access check error:", accessError);
          return new Response(
            JSON.stringify({ error: "Failed to verify course access" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!hasAccess) {
          return new Response(
            JSON.stringify({ error: "Access denied. Please complete your payment to unlock this course." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }


    // Parse video URL to get storage path
    let videoPath = lesson.video_url;
    
    // If it's a full URL, extract the path
    if (videoPath.startsWith("http")) {
      // Check if it's a Supabase storage URL
      const storageUrlPattern = /\/storage\/v1\/object\/(?:public|sign)\/course-videos\/(.+)/;
      const match = videoPath.match(storageUrlPattern);
      if (match) {
        videoPath = match[1];
      } else {
        // External URL - just return it as-is (not protected)
        return new Response(
          JSON.stringify({ 
            signedUrl: lesson.video_url,
            expiresIn: 3600,
            isExternal: true 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate signed URL (5 minutes expiry)
    const expiresIn = 300; // 5 minutes
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from("course-videos")
      .createSignedUrl(videoPath, expiresIn);

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate video URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log access
    const userAgent = req.headers.get("user-agent") || "unknown";
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0] || "unknown";

    await supabaseAdmin.from("video_access_logs").insert({
      user_id: userId,
      lesson_id: lessonId,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return new Response(
      JSON.stringify({
        signedUrl: signedUrlData.signedUrl,
        expiresIn,
        isExternal: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
