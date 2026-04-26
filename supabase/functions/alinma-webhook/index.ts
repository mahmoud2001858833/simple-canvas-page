import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-merchant-id, x-signature',
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

const RESPONSE_CODE_MAP: Record<string, { status: 'paid' | 'failed' | 'pending'; description: string }> = {
  '0': { status: 'paid', description: 'Transaction Successful' },
  '000': { status: 'paid', description: 'Transaction Successful' },
  '1': { status: 'paid', description: 'Transaction Approved' },
  '001': { status: 'paid', description: 'Transaction Approved' },
  '201': { status: 'failed', description: 'Terminal does not exist' },
  '202': { status: 'failed', description: 'Merchant does not exist' },
  '205': { status: 'failed', description: 'Customer in negative list' },
  '209': { status: 'failed', description: 'Terminal status DEACTIVE' },
  '218': { status: 'failed', description: 'MOD10 Check Failed' },
  '220': { status: 'failed', description: 'CVV Check Failed' },
  '223': { status: 'failed', description: 'Card expired' },
  '225': { status: 'failed', description: 'Wrong Terminal password' },
  '259': { status: 'failed', description: 'Risk validation failed' },
  '301': { status: 'failed', description: 'Transaction not allowed for terminal' },
  '304': { status: 'failed', description: 'Currency not supported' },
  '401': { status: 'failed', description: 'Invalid amount' },
  '402': { status: 'failed', description: 'Invalid card number' },
  '403': { status: 'failed', description: 'Missing mandatory fields' },
  '501': { status: 'failed', description: 'Processor declined' },
  '502': { status: 'failed', description: 'Timeout from processor' },
  '503': { status: 'failed', description: 'Error from processor' },
  '504': { status: 'failed', description: 'Insufficient funds' },
  '505': { status: 'failed', description: 'Do not honor' },
  '601': { status: 'failed', description: 'System Error, contact System Admin' },
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  if (entry.count >= RATE_LIMIT) {
    return true;
  }

  entry.count += 1;
  return false;
}

function getPaymentStatus(responseCode: string, result?: string): { status: 'paid' | 'failed' | 'pending'; description: string } {
  if (result === 'SUCCESS') {
    return { status: 'paid', description: 'Payment Successful' };
  }

  if (result === 'FAILURE' || result === 'TIMEOUT') {
    return { status: 'failed', description: result };
  }

  return RESPONSE_CODE_MAP[responseCode] || {
    status: 'failed',
    description: `Unknown response code: ${responseCode}`,
  };
}

function normalizeAmount(value: unknown): string {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(value || '0');
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function generateResponseSignature(
  paymentId: string,
  merchantKey: string,
  responseCode: string,
  amount: string,
): Promise<string> {
  const dataString = `${paymentId}|${merchantKey}|${responseCode}|${amount}`;
  console.log('Response signature input (masked):', `${paymentId}|***|${responseCode}|${amount}`);
  return sha256Hex(dataString);
}

async function verifySignature(
  paymentId: string,
  merchantKey: string,
  responseCode: string,
  amount: string,
  receivedSignature: string,
): Promise<boolean> {
  const expectedSignature = await generateResponseSignature(
    paymentId,
    merchantKey,
    responseCode,
    amount,
  );

  return expectedSignature.toLowerCase() === receivedSignature.toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonResponse({
      success: true,
      status: 'active',
      gateway: 'AlinmaPay',
      version: '3.1',
      signature_format: 'SHA-256',
      message: 'Webhook is ready to receive AlinmaPay notifications',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(clientIP)) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return jsonResponse({ error: 'Too many requests' }, 429);
  }

  try {
    const rawBody = await req.text();
    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('Invalid JSON in webhook payload');
      return jsonResponse({ error: 'Invalid request body' }, 400);
    }

    console.log('=== AlinmaPay Webhook Received ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`IP: ${clientIP}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const responseCode = String(payload.responseCode || '');
    const result = String(payload.result || '');
    const responseDescription = String(payload.responseDescription || payload.reason || '');
    const paymentId = String(payload.paymentId || payload.transactionId || '');
    const transactionId = String(payload.transactionId || payload.paymentId || '');
    const orderDetails = (payload.orderDetails as Record<string, unknown> | null) || {};
    const order = (payload.order as Record<string, unknown> | null) || {};
    const trackId = String(
      payload.trackId ||
      payload.trackid ||
      payload.orderId ||
      orderDetails.orderId ||
      order.orderId ||
      '',
    );
    const receivedSignature = String(payload.signature || '');
    const amountDetails = (payload.amountDetails as Record<string, unknown> | null) || {};
    const amount = normalizeAmount(amountDetails.amount || amountDetails.originalAmount || payload.amount || '0');
    const currency = String(payload.currency || 'SAR');
    const maskedCard = String((payload.cardDetails as Record<string, unknown> | null)?.maskedCard || '');
    const cardBrand = String((payload.cardDetails as Record<string, unknown> | null)?.cardBrand || '');
    const authCode = String(payload.authCode || '');
    const rrn = String(payload.rrn || '');

    let userData: Record<string, unknown> = {};
    try {
      const additionalDetails = (payload.additionalDetails as Record<string, unknown> | null) || {};
      const rawUserData = additionalDetails.userData || payload.userData;
      if (rawUserData) {
        userData = JSON.parse(String(rawUserData));
      }
    } catch {
      console.log('No userData in payload');
    }

    console.log('Parsed webhook data:');
    console.log(`  Track ID: ${trackId}`);
    console.log(`  Payment ID: ${paymentId}`);
    console.log(`  Transaction ID: ${transactionId}`);
    console.log(`  Response Code: ${responseCode}`);
    console.log(`  Result: ${result}`);
    console.log(`  Amount: ${amount} ${currency}`);
    console.log(`  Card: ${maskedCard} (${cardBrand})`);

    let signatureVerified = false;
    if (receivedSignature && paymentId && responseCode) {
      const merchantKey = (Deno.env.get('ALINMA_MERCHANT_KEY') || '').trim();
      if (merchantKey) {
        signatureVerified = await verifySignature(
          paymentId,
          merchantKey,
          responseCode,
          amount,
          receivedSignature,
        );

        if (!signatureVerified) {
          console.error('Signature verification failed — rejecting webhook');
          return jsonResponse({ error: 'Invalid signature' }, 401);
        }

        console.log('Signature verified successfully');
      }
    }

    let payment = null;

    if (userData.paymentId) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('id', userData.paymentId)
        .maybeSingle();
      payment = data;
    }

    if (!payment && trackId) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', trackId)
        .maybeSingle();
      payment = data;
    }

    if (!payment && transactionId) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('tabby_payment_id', transactionId)
        .maybeSingle();
      payment = data;
    }

    if (!payment) {
      console.log('Payment not found in database, logging event only');

      await supabase.from('security_audit_logs').insert({
        action_type: 'alinma_webhook_unknown_payment',
        table_name: 'payments',
        ip_address: clientIP,
        details: {
          trackId,
          paymentId,
          transactionId,
          responseCode,
          result,
          amount,
          rawPayload: payload,
        },
      });

      return jsonResponse({ success: true, message: 'Event logged' });
    }

    if (payment.status !== 'pending') {
      console.log(`Payment ${payment.id} already processed with status: ${payment.status}`);
      return jsonResponse({ success: true, message: 'Payment already processed' });
    }

    const { status: newStatus, description } = getPaymentStatus(responseCode, result);
    console.log(`Mapping response code '${responseCode}' (result: ${result}) to status: ${newStatus}`);

    const updateData: Record<string, unknown> = {
      status: newStatus,
      notes: `AlinmaPay: ${responseDescription || description} | Card: ${maskedCard} | Auth: ${authCode}`,
    };

    if (newStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    if (transactionId) {
      updateData.tabby_payment_id = transactionId;
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment.id)
      .eq('status', 'pending');

    if (updateError) {
      console.error('Error updating payment:', updateError);
      throw updateError;
    }

    console.log(`Payment ${payment.id} updated to status: ${newStatus}`);

    if (newStatus === 'paid' && payment.course_id) {
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', payment.user_id)
        .eq('course_id', payment.course_id)
        .maybeSingle();

      if (!existingEnrollment) {
        const { error: enrollError } = await supabase
          .from('enrollments')
          .insert({
            user_id: payment.user_id,
            course_id: payment.course_id,
            status: 'active',
          });

        if (enrollError) {
          console.error('Error creating enrollment:', enrollError);
        } else {
          console.log(`Enrollment created for user ${payment.user_id} in course ${payment.course_id}`);
        }
      }

      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: 'Payment Successful',
        title_ar: 'تم الدفع بنجاح',
        message: `Your payment has been confirmed. Your course is now active. Card: ${maskedCard}`,
        message_ar: `تم تأكيد الدفع. الدورة الخاصة بك مفعّلة الآن. البطاقة: ${maskedCard}`,
        type: 'success',
        link: `/courses/${payment.course_id}`,
      });
    }

    if (newStatus === 'paid' && payment.request_id) {
      await supabase
        .from('custom_course_requests')
        .update({ status: 'in_progress' })
        .eq('id', payment.request_id);

      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: 'Payment Successful',
        title_ar: 'تم الدفع بنجاح',
        message: 'Your payment has been received. We will start working on your request.',
        message_ar: 'تم استلام دفعتك. سنبدأ العمل على طلبك.',
        type: 'success',
        link: '/dashboard',
      });
    }

    if (newStatus === 'failed') {
      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: 'Payment Failed',
        title_ar: 'فشل الدفع',
        message: `Payment could not be processed. Reason: ${responseDescription || description}`,
        message_ar: `لم نتمكن من معالجة الدفع. السبب: ${responseDescription || description}`,
        type: 'error',
        link: '/checkout',
      });
    }

    await supabase.from('security_audit_logs').insert({
      user_id: payment.user_id,
      action_type: 'alinma_webhook',
      table_name: 'payments',
      record_id: payment.id,
      ip_address: clientIP,
      details: {
        trackId,
        paymentId,
        transactionId,
        responseCode,
        result,
        responseDescription,
        amount,
        maskedCard,
        cardBrand,
        authCode,
        rrn,
        newStatus,
        signature_verified: signatureVerified,
      },
    });

    console.log('=== Webhook processed successfully ===');
    return jsonResponse({ success: true });
  } catch (error: unknown) {
    console.error('Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
