import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chunk-index, x-total-chunks, x-file-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R2_UPLOAD_API = "https://alkaser-upload.jowmahmoud6.workers.dev";

// In-memory storage for chunks (will be cleared after upload completes)
const chunkStorage = new Map<string, { chunks: Map<number, Uint8Array>; totalChunks: number; contentType: string }>();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role - only admin and instructor can upload
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (!userRole || !["admin", "instructor"].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get chunk info from headers
    const chunkIndex = parseInt(req.headers.get("x-chunk-index") || "0");
    const totalChunks = parseInt(req.headers.get("x-total-chunks") || "1");
    const contentType = req.headers.get("content-type") || "video/mp4";
    
    const url = new URL(req.url);
    const fileName = url.searchParams.get("file");

    if (!fileName) {
      return new Response(
        JSON.stringify({ error: "File name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create storage key based on user and filename
    const storageKey = `${userData.user.id}:${fileName}`;

    // Get the chunk data
    const chunkData = new Uint8Array(await req.arrayBuffer());

    if (!chunkData || chunkData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Chunk data is empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}, size: ${chunkData.length}`);

    // If single chunk (small file), upload directly
    if (totalChunks === 1) {
      console.log(`Single chunk upload: ${fileName}, size: ${chunkData.length}`);
      
      const r2Response = await fetch(`${R2_UPLOAD_API}?file=${encodeURIComponent(fileName)}`, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: chunkData,
      });

      if (!r2Response.ok) {
        const errorText = await r2Response.text();
        console.error("R2 upload failed:", errorText);
        return new Response(
          JSON.stringify({ error: `R2 upload failed: ${r2Response.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const r2Data = await r2Response.json();
      return new Response(
        JSON.stringify(r2Data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multi-chunk upload - store chunk
    if (!chunkStorage.has(storageKey)) {
      chunkStorage.set(storageKey, {
        chunks: new Map(),
        totalChunks,
        contentType,
      });
    }

    const storage = chunkStorage.get(storageKey)!;
    storage.chunks.set(chunkIndex, chunkData);

    console.log(`Stored chunk ${chunkIndex + 1}/${totalChunks}, current chunks: ${storage.chunks.size}`);

    // Check if all chunks are received
    if (storage.chunks.size === totalChunks) {
      console.log(`All chunks received for ${fileName}, assembling...`);
      
      // Combine all chunks in order
      let totalSize = 0;
      for (let i = 0; i < totalChunks; i++) {
        totalSize += storage.chunks.get(i)!.length;
      }

      const completeFile = new Uint8Array(totalSize);
      let offset = 0;
      for (let i = 0; i < totalChunks; i++) {
        const chunk = storage.chunks.get(i)!;
        completeFile.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`Assembled file size: ${completeFile.length}, uploading to R2...`);

      // Upload complete file to R2
      const r2Response = await fetch(`${R2_UPLOAD_API}?file=${encodeURIComponent(fileName)}`, {
        method: "PUT",
        headers: { "Content-Type": storage.contentType },
        body: completeFile,
      });

      // Clean up storage
      chunkStorage.delete(storageKey);

      if (!r2Response.ok) {
        const errorText = await r2Response.text();
        console.error("R2 upload failed:", errorText);
        return new Response(
          JSON.stringify({ error: `R2 upload failed: ${r2Response.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const r2Data = await r2Response.json();
      return new Response(
        JSON.stringify(r2Data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chunk stored, waiting for more
    return new Response(
      JSON.stringify({ 
        success: true, 
        chunkReceived: chunkIndex + 1,
        totalChunks,
        waiting: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
