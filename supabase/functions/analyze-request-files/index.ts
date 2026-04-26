import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIClassification {
  university?: string;
  university_en?: string;
  college?: string;
  major?: string;
  subject?: string;
  keywords: string[];
  content_type: string;
  confidence: number;
  raw_text_preview?: string;
}

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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Client with user auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const results: { fileId: string; classification: AIClassification }[] = [];

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

        // Convert to text based on file type
        let textContent = "";
        const fileType = file.file_type?.toLowerCase() || "";
        
        if (fileType.includes("text") || fileType.includes("pdf") || file.file_name?.endsWith(".txt")) {
          textContent = await fileData.text();
        } else if (fileType.includes("image")) {
          // For images, we'll describe what we know
          textContent = `Image file: ${file.file_name}`;
        } else {
          // For other binary files, try to get text
          try {
            textContent = await fileData.text();
          } catch {
            textContent = `Binary file: ${file.file_name}`;
          }
        }

        // Limit text for AI processing
        const textPreview = textContent.substring(0, 5000);

        // Analyze with AI
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are an expert at analyzing educational documents. Analyze the provided content and extract academic metadata. Always respond with valid JSON only, no markdown.`
              },
              {
                role: "user",
                content: `Analyze this educational document content and extract:
1. University name (Arabic and English if detected)
2. College/Faculty
3. Major/Department
4. Subject/Course name
5. Keywords (array of relevant terms)
6. Content type (exam, lecture_notes, slides, summary, assignment, book, other)
7. Confidence score (0-1)

File name: ${file.file_name}
File type: ${file.file_type}

Content:
${textPreview}

Respond ONLY with a JSON object in this exact format:
{
  "university": "Arabic university name or null",
  "university_en": "English university name or null",
  "college": "College name or null",
  "major": "Major name or null",
  "subject": "Subject/Course name or null",
  "keywords": ["keyword1", "keyword2"],
  "content_type": "exam|lecture_notes|slides|summary|assignment|book|other",
  "confidence": 0.85
}`
              }
            ],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.error("AI rate limit exceeded");
            return new Response(
              JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.error("AI API error:", aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content;

        if (!aiContent) {
          console.error("No AI response content");
          continue;
        }

        // Parse AI response
        let classification: AIClassification;
        try {
          // Clean the response (remove markdown code blocks if present)
          let cleanContent = aiContent.trim();
          if (cleanContent.startsWith("```json")) {
            cleanContent = cleanContent.slice(7);
          }
          if (cleanContent.startsWith("```")) {
            cleanContent = cleanContent.slice(3);
          }
          if (cleanContent.endsWith("```")) {
            cleanContent = cleanContent.slice(0, -3);
          }
          
          classification = JSON.parse(cleanContent.trim());
          classification.raw_text_preview = textPreview.substring(0, 500);
        } catch (parseError) {
          console.error("Failed to parse AI response:", parseError);
          classification = {
            keywords: [],
            content_type: "other",
            confidence: 0,
            raw_text_preview: textPreview.substring(0, 500),
          };
        }

        // Update file with classification
        await supabaseAdmin
          .from("request_files")
          .update({ ai_classification: classification })
          .eq("id", file.id);

        results.push({ fileId: file.id, classification });
      } catch (fileError) {
        console.error(`Error processing file ${file.id}:`, fileError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
