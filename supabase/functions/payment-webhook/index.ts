import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createHmac(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(cryptoKey => crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)))
    .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) { rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); return false; }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

// Helper: process successful course payment (enrollment + earnings + notifications)
async function processSuccessfulCoursePayment(
  supabase: ReturnType<typeof createClient>,
  payment: Record<string, any>
) {
  const { user_id, course_id, installment_plan, amount } = payment;
  const plan = installment_plan as Record<string, any> | null;
  const newPaidPercentage = plan?.new_paid_percentage ?? 100;

  // Check existing enrollment
  const { data: existingEnrollment } = await supabase
    .from('enrollments')
    .select('id, paid_percentage')
    .eq('user_id', user_id)
    .eq('course_id', course_id)
    .maybeSingle();

  if (existingEnrollment) {
    // Update paid_percentage
    await supabase.from('enrollments')
      .update({ paid_percentage: newPaidPercentage, status: 'active' })
      .eq('id', existingEnrollment.id);
  } else {
    // Create new enrollment
    await supabase.from('enrollments').insert({
      user_id,
      course_id,
      status: 'active',
      paid_percentage: newPaidPercentage,
    });
  }

  // Fetch course for instructor info
  const { data: course } = await supabase
    .from('courses')
    .select('instructor_id, instructor_commission, title, title_ar')
    .eq('id', course_id)
    .single();

  // Create instructor earnings
  if (course?.instructor_id) {
    const commission = course.instructor_commission || 30;
    const instructorAmount = (Number(amount) * commission) / 100;

    await supabase.from('instructor_earnings').insert({
      instructor_id: course.instructor_id,
      payment_id: payment.id,
      course_id,
      amount: instructorAmount,
      commission_rate: commission,
      status: 'pending',
    });

    // Notify instructor
    const isInstallment = plan?.is_continuation;
    await supabase.from('notifications').insert({
      user_id: course.instructor_id,
      title: isInstallment ? 'Installment Payment Received' : 'New Student Enrolled',
      title_ar: isInstallment ? 'تم استلام دفعة قسط' : 'طالب جديد مسجل',
      message: `Payment of ${Number(amount).toLocaleString()} SAR received. Your earnings: ${(Number(amount) * (commission / 100)).toLocaleString()} SAR`,
      message_ar: `تم استلام دفعة ${Number(amount).toLocaleString()} ر.س. أرباحك: ${(Number(amount) * (commission / 100)).toLocaleString()} ر.س`,
      type: 'success',
      link: '/instructor-dashboard?tab=earnings',
    });
  }

  // Notify student
  const isPartial = newPaidPercentage < 100;
  await supabase.from('notifications').insert({
    user_id,
    title: 'Payment Successful',
    title_ar: 'تم الدفع بنجاح',
    message: isPartial
      ? `Payment confirmed. You now have access to ${newPaidPercentage}% of the course content.`
      : 'Your course enrollment has been activated.',
    message_ar: isPartial
      ? `تم تأكيد الدفع. يمكنك الآن الوصول لـ ${newPaidPercentage}% من محتوى الكورس.`
      : 'تم تفعيل اشتراكك في الكورس.',
    type: 'success',
    link: `/courses/${course_id}`,
  });

  // Send email notification
  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', user_id)
    .single();

  if (studentProfile?.email) {
    supabase.functions.invoke('send-notification-email', {
      body: {
        type: 'payment_confirmed',
        to_email: studentProfile.email,
        to_name: studentProfile.full_name || '',
        amount: Number(amount),
        course_title: course?.title,
        course_title_ar: course?.title_ar,
      },
    }).catch(console.error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const isPayTabs = body.cart_id || body.tran_ref;
    const isTabby = body.payment?.id || body.id;

    console.log('Webhook:', isPayTabs ? 'PayTabs' : isTabby ? 'Tabby' : 'Unknown', JSON.stringify({
      cart_id: body.cart_id, tran_ref: body.tran_ref, status: body.payment_result?.response_status || body.status,
    }));

    if (isPayTabs) {
      // Verify signature
      const paytabsServerKey = Deno.env.get('PAYTABS_SERVER_KEY');
      const signatureHeader = req.headers.get('signature');
      if (paytabsServerKey && signatureHeader) {
        const expected = await createHmac(paytabsServerKey, rawBody);
        if (signatureHeader !== expected) {
          console.error('PayTabs signature verification failed');
          return new Response(JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const paymentId = body.cart_id as string;
      const transactionRef = body.tran_ref as string;
      const responseStatus = (body.payment_result as Record<string, unknown>)?.response_status;
      const responseMessage = (body.payment_result as Record<string, unknown>)?.response_message;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!paymentId || !uuidRegex.test(paymentId)) {
        return new Response(JSON.stringify({ error: 'Invalid payment ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: payment, error: fetchError } = await supabaseClient
        .from('payments').select('*').eq('id', paymentId).single();

      if (fetchError || !payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (payment.status !== 'pending') {
        return new Response(JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (payment.transaction_id && payment.transaction_id !== transactionRef) {
        return new Response(JSON.stringify({ error: 'Transaction ref mismatch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const newStatus = responseStatus === 'A' ? 'paid' : 'failed';

      await supabaseClient.from('payments').update({
        status: newStatus,
        transaction_id: transactionRef,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        notes: String(responseMessage || ''),
      }).eq('id', paymentId).eq('status', 'pending');

      if (newStatus === 'paid' && payment.course_id) {
        await processSuccessfulCoursePayment(supabaseClient, payment);
      }

      if (newStatus === 'paid' && payment.request_id) {
        await supabaseClient.from('custom_course_requests')
          .update({ status: 'in_progress' }).eq('id', payment.request_id);
        await supabaseClient.from('notifications').insert({
          user_id: payment.user_id,
          title: 'Payment Successful', title_ar: 'تم الدفع بنجاح',
          message: 'Your custom request payment has been received.',
          message_ar: 'تم استلام دفعتك لطلبك المخصص.',
          type: 'success', link: '/dashboard',
        });
      }

    } else if (isTabby) {
      const tabbyPaymentId = (body.payment as Record<string, unknown>)?.id || body.id;
      const status = body.status || (body.payment as Record<string, unknown>)?.status;

      if (!tabbyPaymentId) {
        return new Response(JSON.stringify({ error: 'Missing Tabby payment ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: payment, error: fetchError } = await supabaseClient
        .from('payments').select('*').eq('tabby_payment_id', tabbyPaymentId).single();

      if (fetchError || !payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (payment.status !== 'pending') {
        return new Response(JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let newStatus: 'paid' | 'failed' | 'pending' = 'pending';
      if (status === 'AUTHORIZED' || status === 'CLOSED') newStatus = 'paid';
      else if (status === 'REJECTED' || status === 'EXPIRED') newStatus = 'failed';

      await supabaseClient.from('payments').update({
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        installment_plan: body.payment?.installment_plan || null,
      }).eq('id', payment.id).eq('status', 'pending');

      if (newStatus === 'paid' && payment.course_id) {
        await processSuccessfulCoursePayment(supabaseClient, payment);
      }

      if (newStatus === 'paid' && payment.request_id) {
        await supabaseClient.from('custom_course_requests')
          .update({ status: 'in_progress' }).eq('id', payment.request_id);
        await supabaseClient.from('notifications').insert({
          user_id: payment.user_id,
          title: 'Payment Successful', title_ar: 'تم الدفع بنجاح',
          message: 'Your custom request payment has been received.',
          message_ar: 'تم استلام دفعتك لطلبك المخصص.',
          type: 'success', link: '/dashboard',
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unknown webhook source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Error in payment-webhook:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
