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
    const { courseId, requestId, userId, customerEmail, customerName, customerPhone } = await req.json();

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customerEmail || typeof customerEmail !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Must have either courseId or requestId
    if (!courseId && !requestId) {
      return new Response(
        JSON.stringify({ error: 'Must provide courseId or requestId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TABBY_SECRET_KEY = Deno.env.get('TABBY_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    if (!TABBY_SECRET_KEY) {
      console.error('TABBY_SECRET_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // CRITICAL: Fetch the actual price from the database - NEVER trust client-supplied amount
    let validatedAmount: number;
    let itemTitle: string;

    if (courseId) {
      // Validate courseId format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(courseId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid course ID format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: course, error: courseError } = await supabaseClient
        .from('courses')
        .select('price, title, title_ar, is_active')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        console.error('Course not found:', courseError);
        return new Response(
          JSON.stringify({ error: 'Course not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!course.is_active) {
        return new Response(
          JSON.stringify({ error: 'Course is not available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!course.price || course.price <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid course price' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already enrolled
      const { data: existingEnrollment } = await supabaseClient
        .from('enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingEnrollment) {
        return new Response(
          JSON.stringify({ error: 'User is already enrolled in this course' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      validatedAmount = Number(course.price);
      itemTitle = course.title_ar || course.title;
    } else if (requestId) {
      // Validate requestId format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(requestId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid request ID format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: request, error: requestError } = await supabaseClient
        .from('custom_course_requests')
        .select('final_price, estimated_price, title, user_id')
        .eq('id', requestId)
        .single();

      if (requestError || !request) {
        console.error('Request not found:', requestError);
        return new Response(
          JSON.stringify({ error: 'Request not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the request belongs to the user
      if (request.user_id !== userId) {
        console.error('Request user mismatch');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const price = request.final_price || request.estimated_price;
      if (!price || price <= 0) {
        return new Response(
          JSON.stringify({ error: 'Request has no valid price set' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      validatedAmount = Number(price);
      itemTitle = request.title;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing pending payment to prevent duplicates
    const { data: existingPayment } = await supabaseClient
      .from('payments')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('course_id', courseId || null)
      .eq('request_id', requestId || null)
      .eq('status', 'pending')
      .eq('payment_method', 'tabby')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existingPayment) {
      console.log('Found existing pending Tabby payment:', existingPayment.id);
      await supabaseClient.from('payments').delete().eq('id', existingPayment.id);
    }

    // Create payment record with validated amount
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: userId,
        course_id: courseId || null,
        request_id: requestId || null,
        amount: validatedAmount, // Server-validated amount
        payment_method: 'tabby',
        status: 'pending',
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      throw paymentError;
    }

    // Get the base URL for redirects
    const origin = req.headers.get('origin') || 'https://jasorkom.com';

    // Sanitize customer data
    const sanitizedPhone = customerPhone?.replace(/[^0-9+]/g, '') || '+966500000000';
    const sanitizedName = customerName?.replace(/[<>'"]/g, '').substring(0, 100) || 'Customer';

    // Create Tabby checkout session with validated amount
    const tabbyPayload = {
      payment: {
        amount: validatedAmount.toString(), // Server-validated amount
        currency: 'SAR',
        description: itemTitle.substring(0, 200),
        buyer: {
          phone: sanitizedPhone,
          email: customerEmail,
          name: sanitizedName,
        },
        buyer_history: {
          registered_since: new Date().toISOString(),
          loyalty_level: 0,
        },
        order: {
          reference_id: payment.id,
          items: [
            {
              title: itemTitle.substring(0, 100),
              quantity: 1,
              unit_price: validatedAmount.toString(),
              category: 'Education',
            },
          ],
        },
        shipping_address: {
          city: 'Riyadh',
          address: 'Saudi Arabia',
          zip: '12345',
        },
      },
      lang: 'ar',
      merchant_code: 'jasorkom',
      merchant_urls: {
        success: `${origin}/payment/success?payment_id=${payment.id}`,
        cancel: `${origin}/payment/failed?error=cancelled&course_id=${courseId || ''}&request_id=${requestId || ''}`,
        failure: `${origin}/payment/failed?error=declined&course_id=${courseId || ''}&request_id=${requestId || ''}`,
      },
    };

    console.log('Creating Tabby session:', {
      payment_id: payment.id,
      amount: validatedAmount,
      courseId,
      requestId,
    });

    const tabbyResponse = await fetch('https://api.tabby.ai/api/v2/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TABBY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tabbyPayload),
    });

    const tabbyData = await tabbyResponse.json();

    if (!tabbyResponse.ok) {
      console.error('Tabby API error:', tabbyData);
      // Delete the pending payment if Tabby fails
      await supabaseClient.from('payments').delete().eq('id', payment.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment session', details: tabbyData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update payment with Tabby session ID
    await supabaseClient
      .from('payments')
      .update({ tabby_payment_id: tabbyData.id })
      .eq('id', payment.id);

    // Find the installments product and get the checkout URL
    const installmentsProduct = tabbyData.configuration?.available_products?.installments?.[0];
    const checkoutUrl = installmentsProduct?.web_url || tabbyData.configuration?.available_products?.installments?.[0]?.web_url;

    return new Response(
      JSON.stringify({ 
        checkout_url: checkoutUrl,
        payment_id: payment.id,
        tabby_id: tabbyData.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-tabby-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
