import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bunny CDN URL - ONLY USE THIS, NEVER storage.bunnycdn.com
const BUNNY_CDN_URL = "https://joosorkm-videos.b-cdn.net";

// ========================
// MD5 Implementation (RFC 1321)
// ========================
function md5(message: string): string {
  function md5cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function add32(a: number, b: number) {
    return (a + b) & 0xFFFFFFFF;
  }

  function md5blk(s: string) {
    const md5blks: number[] = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  function rhex(n: number) {
    const hex_chr = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) {
      s += hex_chr.charAt((n >> (j * 8 + 4)) & 0x0F) + hex_chr.charAt((n >> (j * 8)) & 0x0F);
    }
    return s;
  }

  function hex(x: number[]) {
    return rhex(x[0]) + rhex(x[1]) + rhex(x[2]) + rhex(x[3]);
  }

  function md5str(s: string) {
    let n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    
    for (i = 64; i <= s.length; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    
    tail[14] = n * 8;
    md5cycle(state, tail);
    
    return hex(state);
  }

  return md5str(message);
}

/**
 * Extract video path from any URL format
 * Converts storage URLs to CDN paths
 */
function extractVideoPath(videoUrl: string): string {
  // Remove any URL prefix to get clean path
  let path = videoUrl;
  
  // Handle storage.bunnycdn.com URLs
  if (path.includes('storage.bunnycdn.com')) {
    const match = path.match(/storage\.bunnycdn\.com\/[^\/]+\/(.+)/);
    if (match) {
      path = match[1];
    }
  }
  
  // Handle any CDN URL
  if (path.includes('.b-cdn.net')) {
    const match = path.match(/\.b-cdn\.net\/(.+)/);
    if (match) {
      path = match[1];
    }
  }
  
  // Handle full https:// URLs
  if (path.startsWith('https://') || path.startsWith('http://')) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      // Not a valid URL, use as-is
    }
  }
  
  // Remove leading slash if exists (we'll add it back)
  path = path.replace(/^\/+/, '');
  
  // Remove query string if exists
  if (path.includes('?')) {
    path = path.split('?')[0];
  }
  
  console.log("[get-bunny-video-url] Extracted path:", path);
  return path;
}

/**
 * Generate secure Bunny CDN URL with token authentication
 * 
 * Bunny CDN Token Format: MD5(security_key + path + expiration_timestamp)
 * Final URL: https://cdn.b-cdn.net/path?token=XXX&expires=YYY
 */
function generateSecureBunnyUrl(videoPath: string, expiresInSeconds: number = 600): string {
  const tokenKey = Deno.env.get("BUNNY_TOKEN_KEY");

  if (!tokenKey) {
    console.error("[get-bunny-video-url] Missing BUNNY_TOKEN_KEY");
    throw new Error("Missing Bunny Token Key");
  }

  // Clean the path
  const cleanPath = extractVideoPath(videoPath);
  
  // Ensure path starts with /
  const signaturePath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  
  // Calculate expiration timestamp (Unix timestamp)
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  
  // Bunny CDN Token Auth format: MD5(security_key + path + expiration_timestamp)
  // IMPORTANT: The order is: tokenKey + path + expires
  const hashableBase = `${tokenKey}${signaturePath}${expires}`;

  console.log("[get-bunny-video-url] Generating token for path:", signaturePath);
  console.log("[get-bunny-video-url] Expires at:", new Date(expires * 1000).toISOString());

  // Create MD5 hash
  const tokenHex = md5(hashableBase);

  // Build final URL using hardcoded CDN URL
  const secureUrl = `${BUNNY_CDN_URL}${signaturePath}?token=${tokenHex}&expires=${expires}`;
  
  console.log("[get-bunny-video-url] Generated URL:", secureUrl.replace(tokenHex, tokenHex.substring(0, 8) + "..."));

  return secureUrl;
}

/**
 * Validate that URL is a proper CDN URL, not a storage URL
 */
function validateCdnUrl(url: string): boolean {
  // Reject storage URLs
  if (url.includes('storage.bunnycdn.com')) {
    console.error("[get-bunny-video-url] INVALID: Storage URL detected:", url);
    return false;
  }
  
  // Reject URLs without token
  if (!url.includes('token=') || !url.includes('expires=')) {
    console.error("[get-bunny-video-url] INVALID: URL missing token or expires");
    return false;
  }
  
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[get-bunny-video-url] =================================");
    console.log("[get-bunny-video-url] Processing video URL request");

    // 1. Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[get-bunny-video-url] No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      console.error("[get-bunny-video-url] Invalid token:", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[get-bunny-video-url] User authenticated:", userData.user.id);

    // 2. Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lessonId, quality } = body;

    if (!lessonId) {
      console.error("[get-bunny-video-url] No lesson ID provided");
      return new Response(JSON.stringify({ error: "Lesson ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[get-bunny-video-url] Requesting video for lesson:", lessonId, "quality:", quality);

    // 3. Fetch lesson data
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, course_id, video_url, video_url_480p, video_url_720p, video_url_1080p, is_preview")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      console.error("[get-bunny-video-url] Lesson not found:", lessonError);
      return new Response(JSON.stringify({ error: "Lesson not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[get-bunny-video-url] Lesson found:", lesson.id);
    console.log("[get-bunny-video-url] Video URLs in DB:", {
      video_url: lesson.video_url?.substring(0, 50),
      video_url_480p: lesson.video_url_480p?.substring(0, 50),
      video_url_720p: lesson.video_url_720p?.substring(0, 50),
      video_url_1080p: lesson.video_url_1080p?.substring(0, 50),
    });

    // 4. Check user permissions
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    const isAdminOrInstructor = roleData?.role === "admin" || roleData?.role === "instructor";

    // If not admin/instructor and not preview, check enrollment
    if (!isAdminOrInstructor && !lesson.is_preview) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("status")
        .eq("user_id", userData.user.id)
        .eq("course_id", lesson.course_id)
        .single();

      if (!enrollment || enrollment.status !== "active") {
        console.error("[get-bunny-video-url] User not enrolled");
        return new Response(JSON.stringify({ error: "Access denied - Enrollment required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Determine video path based on quality
    let videoPath: string | null = null;
    let actualQuality = quality || "auto";

    if (quality === "1080p" && lesson.video_url_1080p) {
      videoPath = lesson.video_url_1080p;
      actualQuality = "1080p";
    } else if (quality === "720p" && lesson.video_url_720p) {
      videoPath = lesson.video_url_720p;
      actualQuality = "720p";
    } else if (quality === "480p" && lesson.video_url_480p) {
      videoPath = lesson.video_url_480p;
      actualQuality = "480p";
    } else if (quality === "auto") {
      // Auto: prefer highest available
      videoPath = lesson.video_url_1080p || lesson.video_url_720p || lesson.video_url_480p || lesson.video_url;
      actualQuality = lesson.video_url_1080p ? "1080p" : 
                      lesson.video_url_720p ? "720p" : 
                      lesson.video_url_480p ? "480p" : "default";
    } else {
      videoPath = lesson.video_url;
      actualQuality = "default";
    }

    if (!videoPath) {
      console.error("[get-bunny-video-url] No video available");
      return new Response(JSON.stringify({ error: "No video available for this lesson" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[get-bunny-video-url] Original video path from DB:", videoPath);

    // 6. Check available qualities
    const availableQualities: string[] = ["auto"];
    if (lesson.video_url_480p) availableQualities.push("480p");
    if (lesson.video_url_720p) availableQualities.push("720p");
    if (lesson.video_url_1080p) availableQualities.push("1080p");

    // 7. Generate secure URL with token (valid for 10 minutes = 600 seconds)
    const expiresIn = 600;
    let secureUrl: string;
    
    try {
      secureUrl = generateSecureBunnyUrl(videoPath, expiresIn);
    } catch (urlError) {
      console.error("[get-bunny-video-url] Failed to generate secure URL:", urlError);
      return new Response(JSON.stringify({ error: "Failed to generate secure URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Validate the generated URL
    if (!validateCdnUrl(secureUrl)) {
      console.error("[get-bunny-video-url] Generated URL validation failed");
      return new Response(JSON.stringify({ error: "Invalid video URL generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[get-bunny-video-url] ✅ Secure URL generated and validated");
    console.log("[get-bunny-video-url] Final URL (masked):", secureUrl.replace(/token=[^&]+/, "token=***"));

    // 9. Log video access for security tracking (non-blocking)
    supabase.from("video_access_logs").insert({
      user_id: userData.user.id,
      lesson_id: lessonId,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    }).then(() => {
      console.log("[get-bunny-video-url] Access log recorded");
    });

    console.log("[get-bunny-video-url] =================================");

    return new Response(JSON.stringify({
      secureUrl,
      expiresIn,
      quality: actualQuality,
      availableQualities,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[get-bunny-video-url] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
