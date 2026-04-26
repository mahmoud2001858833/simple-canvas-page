import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseId, requestId, userId, customerEmail, installmentPercent, isInstallment, couponId } = await req.json();

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!customerEmail || typeof customerEmail !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!courseId && !requestId) {
      return new Response(JSON.stringify({ error: 'Must provide courseId or requestId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const PAYTABS_SERVER_KEY = Deno.env.get('PAYTABS_SERVER_KEY');
    const PAYTABS_PROFILE_ID = Deno.env.get('PAYTABS_PROFILE_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    if (!PAYTABS_SERVER_KEY || !PAYTABS_PROFILE_ID) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(SUPABASE_URL!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    let fullCoursePrice: number;
    let validatedAmount: number;
    let itemTitle: string;
    let installmentPlan: Record<string, unknown> | null = null;

    if (courseId) {
      if (!uuidRegex.test(courseId)) {
        return new Response(JSON.stringify({ error: 'Invalid course ID format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: course, error: courseError } = await supabaseClient
        .from('courses')
        .select('price, title, title_ar, is_active')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        return new Response(JSON.stringify({ error: 'Course not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!course.is_active) {
        return new Response(JSON.stringify({ error: 'Course is not available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!course.price || course.price <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid course price' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      fullCoursePrice = Number(course.price);
      itemTitle = course.title_ar || course.title;

      // Check existing enrollment for installment payments
      const { data: existingEnrollment } = await supabaseClient
        .from('enrollments')
        .select('id, paid_percentage, status')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      const currentPaidPercent = existingEnrollment?.paid_percentage ?? 0;
      const targetPercent = installmentPercent || 100;

      if (existingEnrollment && existingEnrollment.status === 'active' && currentPaidPercent >= 100) {
        return new Response(JSON.stringify({ error: 'User is already fully enrolled in this course' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Calculate the actual amount to charge
      if (isInstallment || targetPercent < 100 || (existingEnrollment && currentPaidPercent < 100)) {
        const percentToPay = targetPercent - currentPaidPercent;
        if (percentToPay <= 0) {
          return new Response(JSON.stringify({ error: 'Nothing to pay' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        validatedAmount = Math.ceil(fullCoursePrice * percentToPay / 100);
        installmentPlan = {
          installment_percent: targetPercent,
          new_paid_percentage: targetPercent,
          is_continuation: !!existingEnrollment,
          previous_paid: currentPaidPercent,
        };
      } else {
        // Full payment, no existing enrollment
        if (existingEnrollment && existingEnrollment.status === 'active') {
          return new Response(JSON.stringify({ error: 'User is already enrolled in this course' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        validatedAmount = fullCoursePrice;
      }

    } else if (requestId) {
      if (!uuidRegex.test(requestId)) {
        return new Response(JSON.stringify({ error: 'Invalid request ID format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: request, error: requestError } = await supabaseClient
        .from('custom_course_requests')
        .select('final_price, estimated_price, title, user_id')
        .eq('id', requestId)
        .single();

      if (requestError || !request) {
        return new Response(JSON.stringify({ error: 'Request not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (request.user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const price = request.final_price || request.estimated_price;
      if (!price || price <= 0) {
        return new Response(JSON.stringify({ error: 'Request has no valid price set' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      validatedAmount = Number(price);
      itemTitle = request.title;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Apply coupon discount if provided
    if (couponId && uuidRegex.test(couponId)) {
      const { data: coupon } = await supabaseClient
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .eq('is_active', true)
        .single();

      if (coupon) {
        let discount = 0;
        if (coupon.discount_type === 'percentage') {
          discount = (validatedAmount * coupon.discount_value) / 100;
          if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
            discount = coupon.max_discount_amount;
          }
        } else {
          discount = Math.min(coupon.discount_value, validatedAmount);
        }
        validatedAmount = Math.max(validatedAmount - discount, 1); // min 1 SAR
      }
    }

    // Clean up existing pending payment
    const { data: existingPayment } = await supabaseClient
      .from('payments')
      .select('id')
      .eq('user_id', userId)
      .eq(courseId ? 'course_id' : 'request_id', courseId || requestId)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existingPayment) {
      await supabaseClient.from('payments').delete().eq('id', existingPayment.id);
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: userId,
        course_id: courseId || null,
        request_id: requestId || null,
        amount: validatedAmount,
        payment_method: 'online',
        status: 'pending',
        installment_plan: installmentPlan,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      throw paymentError;
    }

    const origin = req.headers.get('origin') || 'https://jasorkom.com';

    const paytabsPayload = {
      profile_id: PAYTABS_PROFILE_ID,
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: payment.id,
      cart_description: `${itemTitle.substring(0, 100)}`,
      cart_currency: 'SAR',
      cart_amount: validatedAmount,
      callback: `${SUPABASE_URL}/functions/v1/payment-webhook`,
      return: `${origin}/payment/success?payment_id=${payment.id}`,
      customer_details: { email: customerEmail },
      hide_shipping: true,
    };

    console.log('Creating PayTabs payment:', { payment_id: payment.id, amount: validatedAmount, courseId, requestId, installmentPlan });

    const paytabsResponse = await fetch('https://secure.clickpay.com.sa/payment/request', {
      method: 'POST',
      headers: { 'Authorization': PAYTABS_SERVER_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(paytabsPayload),
    });

    const paytabsData = await paytabsResponse.json();

    if (!paytabsResponse.ok || !paytabsData.redirect_url) {
      console.error('PayTabs API error:', paytabsData);
      await supabaseClient.from('payments').delete().eq('id', payment.id);
      return new Response(JSON.stringify({ error: 'Failed to create payment page', details: paytabsData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabaseClient.from('payments').update({ transaction_id: paytabsData.tran_ref }).eq('id', payment.id);

    return new Response(
      JSON.stringify({ redirect_url: paytabsData.redirect_url, payment_id: payment.id, transaction_ref: paytabsData.tran_ref }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-paytabs-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
