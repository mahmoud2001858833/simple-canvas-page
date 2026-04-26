import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lessonId, messages, action } = await req.json();
    if (!lessonId) throw new Error("lessonId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Get transcript
    const { data: transcriptData } = await supabase
      .from("lesson_transcripts")
      .select("transcript")
      .eq("lesson_id", lessonId)
      .eq("status", "completed")
      .maybeSingle();

    // Get lesson info
    const { data: lesson } = await supabase
      .from("lessons")
      .select("title, title_ar, description, course_id")
      .eq("id", lessonId)
      .single();

    const { data: course } = await supabase
      .from("courses")
      .select("title_ar, title")
      .eq("id", lesson?.course_id)
      .single();

    const contextInfo = transcriptData?.transcript 
      ? `\n\nمحتوى الدرس التفصيلي:\n${transcriptData.transcript}`
      : "";

    const systemPrompt = `أنت مساعد تعليمي ذكي مخصص لمساعدة الطلاب في فهم محتوى الدرس.

معلومات الدرس:
- الكورس: ${course?.title_ar || course?.title || "غير محدد"}
- الدرس: ${lesson?.title_ar || lesson?.title || "غير محدد"}
- الوصف: ${lesson?.description || "غير محدد"}
${contextInfo}

التعليمات:
1. أجب دائماً باللغة العربية
2. ركز إجاباتك على محتوى الدرس المحدد
3. إذا سُئلت عن شيء خارج نطاق الدرس، وجه الطالب بلطف للموضوع
4. استخدم أمثلة توضيحية عند الحاجة
5. كن موجزاً ومفيداً
6. عند التلخيص، غطِّ النقاط الأساسية بتنظيم واضح
7. لا تذكر أنك تقرأ من "محتوى" أو "نص" - تحدث كأنك تعرف المادة`;

    // Handle quick actions
    let userMessages = messages || [];
    if (action === "summarize") {
      userMessages = [{ role: "user", content: "لخصلي هذا الدرس بشكل مختصر ومنظم مع ذكر أهم النقاط" }];
    } else if (action === "explain") {
      userMessages = [{ role: "user", content: "اشرحلي أهم المفاهيم في هذا الدرس بطريقة مبسطة" }];
    } else if (action === "keypoints") {
      userMessages = [{ role: "user", content: "ما هي أهم النقاط الرئيسية التي يجب أن أركز عليها في هذا الدرس؟" }];
    }

    if (!userMessages.length) throw new Error("No messages provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...userMessages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("lesson-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
