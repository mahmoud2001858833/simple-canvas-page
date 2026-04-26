import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lessonId } = await req.json();
    if (!lessonId) throw new Error("lessonId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin or instructor
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Check role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    
    if (!roles || !["admin", "instructor"].includes(roles.role)) {
      throw new Error("Only admins/instructors can generate transcripts");
    }

    // Check if transcript already exists
    const { data: existing } = await supabase
      .from("lesson_transcripts")
      .select("id, status")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existing && existing.status === "completed") {
      return new Response(JSON.stringify({ message: "Transcript already exists", status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    if (existing) {
      await supabase.from("lesson_transcripts").update({ status: "processing" }).eq("id", existing.id);
    } else {
      await supabase.from("lesson_transcripts").insert({ lesson_id: lessonId, transcript: "", status: "processing" });
    }

    // Get lesson info
    const { data: lesson } = await supabase
      .from("lessons")
      .select("title, title_ar, description, course_id")
      .eq("id", lessonId)
      .single();

    if (!lesson) throw new Error("Lesson not found");

    // Get course info
    const { data: course } = await supabase
      .from("courses")
      .select("title, title_ar, description, description_ar, category")
      .eq("id", lesson.course_id)
      .single();

    // Generate a comprehensive transcript using AI based on lesson metadata
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `أنت مساعد تعليمي متخصص. بناءً على المعلومات التالية عن درس جامعي، أنشئ محتوى تعليمي شامل ومفصل باللغة العربية يغطي الموضوع بشكل كامل.

معلومات الكورس:
- اسم الكورس: ${course?.title_ar || course?.title || "غير محدد"}
- وصف الكورس: ${course?.description_ar || course?.description || "غير محدد"}
- التصنيف: ${course?.category || "غير محدد"}

معلومات الدرس:
- عنوان الدرس: ${lesson.title_ar || lesson.title}
- وصف الدرس: ${lesson.description || "غير محدد"}

المطلوب:
1. اكتب شرحاً تفصيلياً وشاملاً لموضوع الدرس (على الأقل 2000 كلمة)
2. غطِّ جميع المفاهيم الأساسية والفرعية
3. أضف أمثلة توضيحية
4. اذكر النقاط المهمة التي يجب على الطالب فهمها
5. نظّم المحتوى بعناوين فرعية واضحة
6. استخدم لغة أكاديمية مبسطة مناسبة لطلاب الجامعة

اكتب المحتوى التعليمي الآن:`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "أنت أستاذ جامعي متخصص تقوم بإعداد محتوى تعليمي شامل ومفصل للطلاب." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      
      await supabase.from("lesson_transcripts")
        .update({ status: "failed" })
        .eq("lesson_id", lessonId);
      
      throw new Error("Failed to generate transcript");
    }

    const aiData = await aiResponse.json();
    const transcript = aiData.choices?.[0]?.message?.content || "";

    if (!transcript) {
      await supabase.from("lesson_transcripts")
        .update({ status: "failed" })
        .eq("lesson_id", lessonId);
      throw new Error("Empty transcript generated");
    }

    // Save transcript
    await supabase.from("lesson_transcripts")
      .update({ transcript, status: "completed", generated_at: new Date().toISOString() })
      .eq("lesson_id", lessonId);

    return new Response(JSON.stringify({ message: "Transcript generated successfully", status: "completed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-transcript error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
