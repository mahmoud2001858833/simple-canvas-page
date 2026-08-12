import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token || token === anonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId);
    const isStaff = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'secretary');
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
    if (!/^[0-9a-fA-F-]{36}$/.test(requestId)) {
      return new Response(JSON.stringify({ error: 'Invalid requestId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: request, error: reqErr } = await admin
      .from('custom_course_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: files } = await admin
      .from('request_files')
      .select('file_name, file_type, file_category, ai_classification')
      .eq('request_id', requestId);

    // Instructors with their profile data
    const { data: instructorRoles } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'instructor');
    const instructorIds = (instructorRoles || []).map((r: any) => r.user_id);

    let instructors: any[] = [];
    if (instructorIds.length) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, full_name, full_name_ar, specialty, academic_degree, academic_year, teaching_experience_years, teaching_experience_details, institution_name, teaching_year, offers_research_services')
        .in('id', instructorIds);
      instructors = profs || [];

      // course load per instructor
      const { data: courses } = await admin
        .from('courses')
        .select('instructor_id, title_ar, subject_name, category')
        .in('instructor_id', instructorIds);
      const byInstructor: Record<string, string[]> = {};
      (courses || []).forEach((c: any) => {
        if (!c.instructor_id) return;
        byInstructor[c.instructor_id] = byInstructor[c.instructor_id] || [];
        byInstructor[c.instructor_id].push([c.title_ar, c.subject_name, c.category].filter(Boolean).join(' - '));
      });
      instructors = instructors.map((i) => ({ ...i, courses: byInstructor[i.id] || [] }));
    }

    if (!instructors.length) {
      return new Response(JSON.stringify({ error: 'no_instructors' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promptPayload = {
      request: {
        title: request.title,
        description: request.description,
        institution: request.institution,
        specialty: request.specialty,
        course_name: request.course_name,
        doctor_name: request.doctor_name,
        academic_year: request.academic_year,
        section: request.section,
        delivery_method: request.delivery_method,
        deadline: request.deadline,
        status: request.status,
      },
      files: (files || []).map((f: any) => ({
        name: f.file_name, type: f.file_type, category: f.file_category, ai: f.ai_classification,
      })),
      instructors: instructors.map((i) => ({
        id: i.id,
        name: i.full_name_ar || i.full_name,
        specialty: i.specialty,
        academic_degree: i.academic_degree,
        academic_year: i.academic_year,
        experience_years: i.teaching_experience_years,
        experience_details: i.teaching_experience_details,
        institution: i.institution_name,
        current_courses: i.courses,
      })),
    };

    const instructions = `أنت مستشار أكاديمي لمنصة "جسوركم" التعليمية.
حلّل طلب الدورة الخاصة والملفات المرفقة، ثم رشّح أفضل المعلمين من القائمة المعطاة لتنفيذ الدورة.
قواعد صارمة:
- استخدم فقط معرفات المعلمين (id) الموجودة في القائمة، ولا تخترع أي معرف.
- رتّب الترشيحات من الأفضل إلى الأقل، بحد أقصى 3 معلمين.
- score من 0 إلى 100 يعبّر عن مدى الملاءمة.
- اكتب كل النصوص بالعربية، ومختصرة وعملية.
- لا تستخدم كلمة "جامعة"، استخدم "جهة أكاديمية"، واستخدم "دورة" لا "كورس".
- advice: نصائح تنفيذية للأدمن حول بناء هذه الدورة (المحتوى، المدة، السعر التقديري، المخاطر).`;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        estimated_hours: { type: ["number", "null"] },
        suggested_price: { type: ["number", "null"] },
        advice: { type: "array", items: { type: "string" } },
        recommendations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              instructor_id: { type: "string" },
              instructor_name: { type: "string" },
              score: { type: "number" },
              reason: { type: "string" },
            },
            required: ["instructor_id", "instructor_name", "score", "reason"],
          },
        },
      },
      required: ["summary", "estimated_hours", "suggested_price", "advice", "recommendations"],
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        instructions,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `بيانات الطلب والمعلمين (JSON):\n${JSON.stringify(promptPayload)}` },
            ],
          },
        ],
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        text: {
          format: {
            type: "json_schema",
            name: "request_recommendation",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
      return new Response(JSON.stringify({ error: 'ai_error', status: aiRes.status, details: errText }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read the SSE stream and accumulate the final text
    const reader = aiRes.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
            text += evt.delta;
          }
          if (evt.type === 'response.completed' && evt.response?.output_text) {
            const ot = Array.isArray(evt.response.output_text)
              ? evt.response.output_text.join('')
              : evt.response.output_text;
            if (ot && !text) text = ot;
          }
        } catch { /* ignore partial */ }
      }
    }

    let analysis: any;
    try {
      analysis = JSON.parse(text);
    } catch {
      console.error('Failed to parse AI output:', text.slice(0, 500));
      return new Response(JSON.stringify({ error: 'parse_error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Keep only recommendations pointing at real instructors
    const validIds = new Set(instructors.map((i) => i.id));
    analysis.recommendations = (analysis.recommendations || [])
      .filter((r: any) => validIds.has(r.instructor_id))
      .slice(0, 3);
    analysis.generated_at = new Date().toISOString();

    const { error: updErr } = await admin
      .from('custom_course_requests')
      .update({ ai_analysis: analysis })
      .eq('id', requestId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('analyze-request-recommendation error:', error);
    return new Response(JSON.stringify({ error: String((error as Error)?.message || error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
