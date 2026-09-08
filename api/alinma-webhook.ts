import { createClient } from '@supabase/supabase-js';

// Configuration matching the active Supabase project
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://ixhvcxwbiisrxhngfjyg.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aHZjeHdiaWlzcnhobmdmanlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Nzk5MzUsImV4cCI6MjA4NDA1NTkzNX0.wVgnjXhuuUn4T-bVULzE8ModNbQsTyseGsdDRAIVGrA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUCCESS_CODES = new Set([
  '0', '00', '000', '1', '001', 'SUCCESS', 'SUCCESSFUL', 'CAPTURED', 'PAID', 'APPROVED'
]);

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, apikey, Content-Type, x-merchant-id, x-signature'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check for GET requests from browser or bank validation
  if (req.method === 'GET') {
    const query = req.query || {};
    const hasPaymentData = query.trackId || query.orderId || query.paymentId || query.result;

    if (!hasPaymentData) {
      return res.status(200).json({
        success: true,
        status: 'active',
        gateway: 'AlinmaPay',
        endpoint: '/api/alinma-webhook',
        message: 'Alinma Bank webhook endpoint is active and ready to receive transactions.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  try {
    // Parse payload from body and query
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        const params = new URLSearchParams(body);
        const obj: Record<string, any> = {};
        params.forEach((v, k) => { obj[k] = v; });
        body = obj;
      }
    }

    const payload = {
      ...(req.query || {}),
      ...body,
    };

    console.log('Alinma Webhook received payload:', JSON.stringify(payload));

    // Forward to Supabase Edge Function asynchronously for redundant audit logging
    fetch('https://ixhvcxwbiisrxhngfjyg.supabase.co/functions/v1/alinma-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    }).catch((err) => console.warn('Forward to Supabase edge function failed:', err));

    const orderObj = payload.order || {};
    const orderDetails = payload.orderDetails || {};

    const trackId = String(
      payload.trackId ||
      payload.trackid ||
      payload.TrackId ||
      payload.TrackID ||
      payload.orderId ||
      payload.order_id ||
      orderObj.orderId ||
      orderDetails.orderId ||
      ''
    ).trim();

    const paymentId = String(
      payload.paymentId ||
      payload.paymentid ||
      payload.PaymentID ||
      payload.transactionId ||
      payload.tranid ||
      payload.trans_id ||
      ''
    ).trim();

    const transactionId = String(
      payload.transactionId ||
      payload.tranid ||
      payload.trans_id ||
      payload.TranID ||
      ''
    ).trim();

    const result = String(
      payload.result ||
      payload.Result ||
      payload.status ||
      payload.Status ||
      'SUCCESS'
    ).trim().toUpperCase();

    const responseCode = String(
      payload.responseCode ||
      payload.response_code ||
      payload.ResponseCode ||
      payload.code ||
      '000'
    ).trim();

    // Check if result indicates success
    const isSuccess = SUCCESS_CODES.has(result) || SUCCESS_CODES.has(responseCode);

    // Look for payment in Supabase
    let payment: any = null;

    // 1. By internal UUID
    const uuidCandidate = [paymentId, trackId, String(payload.id || '')].find((v) =>
      v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    );
    if (uuidCandidate) {
      const { data } = await supabase.from('payments').select('*').eq('id', uuidCandidate).maybeSingle();
      if (data) payment = data;
    }

    // 2. By transaction_id = trackId
    if (!payment && trackId) {
      const { data } = await supabase.from('payments').select('*').eq('transaction_id', trackId).maybeSingle();
      if (data) payment = data;
    }

    // 3. By tabby_payment_id = transactionId / paymentId
    if (!payment && (transactionId || paymentId)) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('tabby_payment_id', transactionId || paymentId)
        .maybeSingle();
      if (data) payment = data;
    }

    // 4. By transaction_id = paymentId
    if (!payment && paymentId) {
      const { data } = await supabase.from('payments').select('*').eq('transaction_id', paymentId).maybeSingle();
      if (data) payment = data;
    }

    if (!payment) {
      console.warn('Payment not found for payload:', { trackId, paymentId, transactionId });
      return res.status(200).json({
        success: true,
        message: 'Webhook received and logged (payment ID pending reconciliation)',
        trackId,
      });
    }

    console.log(`Matched payment: ${payment.id} (user: ${payment.user_id}, course: ${payment.course_id})`);

    if (isSuccess) {
      // 1. Update payment to paid
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          tabby_payment_id: transactionId || paymentId || payment.tabby_payment_id,
          notes: `${payment.notes || ''} | Alinma Webhook Confirmed: ${result} (${responseCode})`.trim(),
        })
        .eq('id', payment.id);

      // 2. Activate course enrollment immediately
      if (payment.course_id && payment.user_id) {
        await supabase.from('enrollments').upsert(
          {
            user_id: payment.user_id,
            course_id: payment.course_id,
            status: 'active',
            paid_percentage: 100,
            enrolled_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,course_id' }
        );
        console.log(`Course ${payment.course_id} unlocked for user ${payment.user_id}`);
      }

      // 3. If custom course request
      if (payment.request_id) {
        await supabase
          .from('custom_course_requests')
          .update({ status: 'in_progress' })
          .eq('id', payment.request_id);
      }

      return res.status(200).json({
        success: true,
        status: 'paid',
        payment_id: payment.id,
        message: 'Payment confirmed and course activated successfully',
      });
    } else {
      // Payment declined/failed
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          notes: `${payment.notes || ''} | Alinma Webhook Declined: ${result} (${responseCode})`.trim(),
        })
        .eq('id', payment.id);

      return res.status(200).json({
        success: true,
        status: 'failed',
        payment_id: payment.id,
        message: 'Payment recorded as failed',
      });
    }
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(200).json({
      success: true,
      message: 'Webhook received with warning',
      error: error?.message || 'Unknown error',
    });
  }
}
