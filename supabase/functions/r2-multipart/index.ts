import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "alkaser-videos";

// R2 endpoint
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Create AWS client for R2
const r2Client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

interface MultipartUploadRequest {
  action: "create" | "sign" | "complete" | "abort";
  fileName?: string;
  contentType?: string;
  uploadId?: string;
  objectKey?: string;
  partNumber?: number;
  parts?: Array<{ partNumber: number; etag: string }>;
}

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

    const body: MultipartUploadRequest = await req.json();
    const { action } = body;

    console.log(`Multipart action: ${action}`, body);

    switch (action) {
      case "create":
        return await handleCreateMultipartUpload(body);
      case "sign":
        return await handleSignPartUrl(body);
      case "complete":
        return await handleCompleteMultipartUpload(body);
      case "abort":
        return await handleAbortMultipartUpload(body);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Multipart upload error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Create a new multipart upload
async function handleCreateMultipartUpload(body: MultipartUploadRequest) {
  const { fileName, contentType = "video/mp4" } = body;

  if (!fileName) {
    return new Response(
      JSON.stringify({ error: "fileName is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const objectKey = `videos/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}?uploads`;

  console.log(`Creating multipart upload for: ${objectKey}`);

  const response = await r2Client.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create multipart upload:", errorText);
    return new Response(
      JSON.stringify({ error: "Failed to create multipart upload" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const xmlResponse = await response.text();
  console.log("Create multipart response:", xmlResponse);

  // Parse uploadId from XML response
  const uploadIdMatch = xmlResponse.match(/<UploadId>(.+?)<\/UploadId>/);
  if (!uploadIdMatch) {
    return new Response(
      JSON.stringify({ error: "Failed to get uploadId" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const uploadId = uploadIdMatch[1];

  return new Response(
    JSON.stringify({
      success: true,
      uploadId,
      objectKey,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Generate a signed URL for uploading a part
async function handleSignPartUrl(body: MultipartUploadRequest) {
  const { uploadId, objectKey, partNumber } = body;

  if (!uploadId || !objectKey || !partNumber) {
    return new Response(
      JSON.stringify({ error: "uploadId, objectKey, and partNumber are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create the URL for this part with expiration
  const expiresIn = 3600; // 1 hour
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}?partNumber=${partNumber}&uploadId=${uploadId}&X-Amz-Expires=${expiresIn}`;

  // Generate signed URL
  const signedRequest = await r2Client.sign(
    new Request(url, {
      method: "PUT",
    }),
    {
      aws: { signQuery: true },
    }
  );

  const signedUrl = signedRequest.url;

  console.log(`Generated signed URL for part ${partNumber}, expires at ${new Date(expiresAt * 1000).toISOString()}`);

  return new Response(
    JSON.stringify({
      success: true,
      signedUrl,
      partNumber,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Complete the multipart upload
async function handleCompleteMultipartUpload(body: MultipartUploadRequest) {
  const { uploadId, objectKey, parts } = body;

  if (!uploadId || !objectKey || !parts || parts.length === 0) {
    return new Response(
      JSON.stringify({ error: "uploadId, objectKey, and parts are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Sort parts by part number
  const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);

  // Build the XML body for completing the upload
  const partsXml = sortedParts
    .map(
      (part) => `
    <Part>
      <PartNumber>${part.partNumber}</PartNumber>
      <ETag>${part.etag}</ETag>
    </Part>`
    )
    .join("");

  const completeXml = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${partsXml}
</CompleteMultipartUpload>`;

  const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}?uploadId=${uploadId}`;

  console.log(`Completing multipart upload: ${objectKey} with ${parts.length} parts`);

  const response = await r2Client.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
    },
    body: completeXml,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to complete multipart upload:", errorText);
    return new Response(
      JSON.stringify({ error: "Failed to complete multipart upload", details: errorText }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = await response.text();
  console.log("Complete multipart response:", result);

  // Extract the final location/key
  const locationMatch = result.match(/<Location>(.+?)<\/Location>/);
  const keyMatch = result.match(/<Key>(.+?)<\/Key>/);

  return new Response(
    JSON.stringify({
      success: true,
      objectKey,
      location: locationMatch?.[1],
      key: keyMatch?.[1] || objectKey,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Abort a multipart upload
async function handleAbortMultipartUpload(body: MultipartUploadRequest) {
  const { uploadId, objectKey } = body;

  if (!uploadId || !objectKey) {
    return new Response(
      JSON.stringify({ error: "uploadId and objectKey are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}?uploadId=${uploadId}`;

  console.log(`Aborting multipart upload: ${objectKey}`);

  const response = await r2Client.fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to abort multipart upload:", errorText);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
