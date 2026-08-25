import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // AuthN + AuthZ: instructor or admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isInstructor } = await supabase.rpc("has_role", { _user_id: user.id, _role: "instructor" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isInstructor && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, image } = await req.json();
    if (!messages || !messages.length) throw new Error("messages required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");


    const systemPrompt = `أنت مساعد ذكي مخصص للمعلمين والمحاضرين. مهمتك مساعدتهم في:
1. إعداد المحتوى التعليمي والمناهج
2. تصميم الاختبارات والأسئلة
3. شرح المفاهيم الأكاديمية
4. تحليل الصور والوثائق التعليمية
5. اقتراحات لتحسين أساليب التدريس
6. أي أسئلة تعليمية أو تقنية

التعليمات:
- أجب باللغة العربية بشكل افتراضي إلا إذا طُلب غير ذلك
- كن موجزاً ومفيداً
- استخدم تنسيق Markdown عند الحاجة
- إذا تم إرسال صورة، حللها وأجب عنها بالتفصيل
=== قواعد التنسيق (إلزامية) ===
- استخدم Markdown دائماً: عناوين بـ ### للأقسام، و- للنقاط، و**غامق** للمصطلحات المهمة.
- سطر فارغ بين كل قسم وآخر، ولا تكتب فقرات طويلة متلاصقة.
- لا تكتب أرقام الأقسام كنص عادي (مثل "2. القاعدة")؛ اكتبها هكذا: "### 2. القاعدة".
- كل معادلة مستقلة في سطر منفصل بـ $$...$$ مع سطر فارغ قبلها وبعدها.
- الخطوات الحسابية تكون قائمة مرقّمة، كل خطوة: شرح قصير بالعربية ثم المعادلة في سطرها.

=== قواعد كتابة المعادلات (إلزامية 100%) ===
- اكتب كل المعادلات الرياضية والفيزيائية بصيغة LaTeX حصراً، ولا تكتبها كنص عادي أبداً.
- معادلة داخل السطر: استخدم محددات LaTeX فقط بدون تهريب: $...$، ومعادلة مستقلة: $$...$$. لا تكتب \$ أبداً ولا تكتب رمز الدولار كنص ظاهر.
- استخدم الأوامر الصحيحة: \\frac{a}{b} \\sqrt{x} \\sum_{i=1}^{n} \\int_a^b \\lim_{x \\to 0} \\vec{F} \\Delta \\theta \\alpha \\beta \\pi \\approx \\neq \\leq \\geq \\times \\cdot \\pm \\infty
- الأسس والفهارس: x^{2} و v_{0} مع الأقواس المعقوفة دائماً.
- الوحدات الفيزيائية: \\, \\text{m/s}^2 داخل المعادلة (مثال: $g = 9.8\\,\\text{m/s}^2$).
- المصفوفات والأنظمة: \\begin{pmatrix}...\\end{pmatrix} و \\begin{cases}...\\end{cases}
- التفاعلات الكيميائية والرموز: استخدم \\text{} للنص العربي أو الإنجليزي داخل المعادلة، ولا تضع نصاً عربياً حراً داخل LaTeX.
- افتح وأغلق الفواصل بنفس النوع تماماً: $...$ أو $$...$$ ولا تخلط بينهما ($x$$ خطأ).
- لا تكتب الرموز الرياضية كنص عادي مثل dxdy أو dx2d2y؛ اكتبها LaTeX: $\\frac{dy}{dx}$ و $\\frac{d^{2}y}{dx^{2}}$.
- اجعل النص العربي في سطر والمعادلة في سطر منفصل بعده، ولا تدمج المعادلة داخل جملة طويلة.
- تحقق من توازن الأقواس وصحة الصيغة قبل الإرسال؛ يجب أن تكون كل معادلة قابلة للعرض بـ KaTeX دون أخطاء.
- عند الحل خطوة بخطوة: اشرح بالعربية خارج المعادلة، وضع كل خطوة حسابية في سطر معادلة مستقل $$...$$.
`;

    // Build messages for the API
    const apiMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of messages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    // If image is provided, modify the last user message to include it
    if (image) {
      const lastMsg = apiMessages[apiMessages.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.content = [
          { type: "text", text: lastMsg.content || "حلل هذه الصورة" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
        ];
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("instructor-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
