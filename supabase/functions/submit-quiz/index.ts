import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get user from JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quizId, answers } = await req.json() as {
      quizId: string;
      answers: Record<string, string>; // questionId -> optionId
    };

    if (!quizId || !answers || typeof answers !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch questions with correct answers server-side using service role
    const { data: questions, error: qError } = await serviceClient
      .from('quiz_questions')
      .select('id, question, question_ar, quiz_options(id, is_correct, option_text, option_text_ar)')
      .eq('quiz_id', quizId)
      .order('sort_order');

    if (qError || !questions) {
      return new Response(JSON.stringify({ error: 'Quiz not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const total = questions.length;
    let score = 0;
    const review: Array<{
      questionId: string;
      isCorrect: boolean;
      correctOptionId: string | null;
      selectedOptionId: string | null;
    }> = [];

    for (const q of questions) {
      const selectedOptionId = answers[q.id] || null;
      const correctOption = (q.quiz_options || []).find((o: any) => o.is_correct);
      const isCorrect = selectedOptionId != null && correctOption?.id === selectedOptionId;
      if (isCorrect) score++;

      review.push({
        questionId: q.id,
        isCorrect,
        correctOptionId: correctOption?.id || null,
        selectedOptionId,
      });
    }

    // Store attempt using service role
    await serviceClient.from('quiz_attempts').insert({
      quiz_id: quizId,
      user_id: user.id,
      score,
      total_questions: total,
    });

    return new Response(JSON.stringify({ score, total, review }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in submit-quiz:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
