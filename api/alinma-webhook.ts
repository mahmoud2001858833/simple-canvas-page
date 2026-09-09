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

    const orderObj = payload.order || {};
    const orderDetails = payload.orderDetails || {};
    const addDetails = payload.additionalDetails || {};

    // Extract userData if present
    let parsedUserData: Record<string, any> = {};
    try {
      const rawUD = addDetails.userData || payload.userData || payload.metadata;
      if (typeof rawUD === 'string') {
        parsedUserData = JSON.parse(rawUD);
      } else if (typeof rawUD === 'object' && rawUD !== null) {
        parsedUserData = rawUD;
      }
    } catch {}

    // Extract reference across all Alinma formats (Hosted Checkout, Apple Pay, Inquiry)
    const alinmaRef = String(
      payload.transactionRef ||
      payload.TransactionRef ||
      payload.tranRef ||
      payload.TranRef ||
      payload.transaction_ref ||
      payload.referenceId ||
      payload.ReferenceId ||
      payload.referenceNo ||
      payload.ReferenceNo ||
      payload.refNumber ||
      payload.ref ||
      payload.MerchantTxnId ||
      ''
    ).trim();

    const trackId = String(
      payload.trackId ||
      payload.trackid ||
      payload.TrackId ||
      payload.TrackID ||
      payload.orderId ||
      payload.order_id ||
      orderObj.orderId ||
      orderDetails.orderId ||
      parsedUserData.orderId ||
      ''
    ).trim();

    const paymentId = String(
      parsedUserData.paymentId ||
      payload.paymentId ||
      payload.paymentid ||
      payload.PaymentID ||
      payload.transactionId ||
      payload.tranid ||
      payload.trans_id ||
      alinmaRef ||
      ''
    ).trim();

    const transactionId = String(
      alinmaRef ||
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
      payload.transStatus ||
      'SUCCESS'
    ).trim().toUpperCase();

    const responseCode = String(
      payload.responseCode ||
      payload.response_code ||
      payload.ResponseCode ||
      payload.code ||
      payload.ResultCode ||
      '000'
    ).trim();

    const eventName = String(
      payload.event ||
      payload.eventType ||
      payload.Event ||
      payload.action ||
      payload.notificationType ||
      ''
    ).trim();

    const normEvent = eventName.toUpperCase();

    const normResult = result.toUpperCase();
    const isSuccess =
      SUCCESS_CODES.has(normResult) ||
      SUCCESS_CODES.has(responseCode) ||
      normResult.includes('SUCCESS') ||
      normResult.includes('CAPTURED') ||
      normResult.includes('APPROVED') ||
      normResult.includes('PAID') ||
      normEvent.includes('SUCCESS') ||
      normEvent.includes('CAPTURED') ||
      responseCode === '000' ||
      responseCode === '00' ||
      responseCode === '0';

    const FAILURE_CODES = new Set([
      '201', '202', '205', '209', '218', '220', '223', '225', '259',
      '301', '304', '401', '402', '403', '501', '502', '503', '504', '505', '601',
      'FAILURE', 'UNSUCCESSFUL', 'DECLINED', 'CANCELED', 'CANCELLED', 'TIMEOUT', 'REJECTED'
    ]);

    const isFailure =
      FAILURE_CODES.has(normResult) ||
      FAILURE_CODES.has(responseCode) ||
      normResult.includes('DECLIN') ||
      normResult.includes('CANCEL') ||
      normResult.includes('FAIL') ||
      normEvent.includes('DECLIN') ||
      normEvent.includes('CANCEL') ||
      normEvent.includes('FAIL') ||
      normEvent.includes('TIMEOUT');

    // Look for payment in Supabase
    let payment: any = null;

    // 1. By internal UUID
    const uuidCandidate = [parsedUserData.paymentId, paymentId, trackId, String(payload.id || '')].find((v) =>
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

    // 3. By tabby_payment_id = transactionId / paymentId / alinmaRef
    const lookupRef = transactionId || paymentId || alinmaRef;
    if (!payment && lookupRef) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('tabby_payment_id', lookupRef)
        .maybeSingle();
      if (data) payment = data;
    }

    // 4. By transaction_id = paymentId / alinmaRef
    if (!payment && lookupRef) {
      const { data } = await supabase.from('payments').select('*').eq('transaction_id', lookupRef).maybeSingle();
      if (data) payment = data;
    }

    // 5. By customer email (matches most recent payment)
    const emailCandidate = String(payload.customerEmail || payload.email || orderObj.customerEmail || '').trim().toLowerCase();
    if (!payment && emailCandidate && emailCandidate.includes('@')) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('email', emailCandidate).maybeSingle();
      if (prof?.id) {
        const { data: recentList } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', prof.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (recentList && recentList[0]) payment = recentList[0];
      }
    }

    // Forward enriched payload to Supabase Edge Function (has full Service Role access)
    const forwardPayload = {
      ...payload,
      trackId: trackId || payment?.transaction_id,
      paymentId: payment?.id || paymentId,
      transactionId: transactionId || payment?.tabby_payment_id,
      additionalDetails: {
        userData: JSON.stringify({
          paymentId: payment?.id || paymentId,
          courseId: payment?.course_id,
          orderId: trackId || payment?.transaction_id,
        }),
      },
    };

    fetch('https://ixhvcxwbiisrxhngfjyg.supabase.co/functions/v1/alinma-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(forwardPayload),
    }).catch((err) => console.warn('Forward to Supabase edge function failed:', err));

    // Call authoritative RPC to bypass any RLS limitations and activate enrollment immediately
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('process_alinma_webhook', {
        p_track_id: trackId || payment?.transaction_id || paymentId,
        p_transaction_id: transactionId || payment?.tabby_payment_id || paymentId,
        p_result: result,
        p_response_code: responseCode,
        p_raw_payload: payload,
      });
      console.log('process_alinma_webhook RPC result:', rpcResult, rpcError);
    } catch (rpcErr) {
      console.warn('RPC call fallback:', rpcErr);
    }

    if (!payment) {
      console.warn('Payment not found for payload:', { trackId, paymentId, transactionId });
      return res.status(200).json({
        success: true,
        message: 'Webhook processed via database reconciliation',
        trackId,
      });
    }

    console.log(`Matched payment: ${payment.id} (user: ${payment.user_id}, course: ${payment.course_id})`);

    if (isSuccess) {
      // 1. Update payment to paid (even if it was previously marked failed by timeout/creation events)
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
    } else if (isFailure) {
      // Explicit payment failure
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
    } else {
      // Non-terminal event (e.g. TransactionCreated, LinkBased.Created, InProgress)
      // DO NOT mark as failed! Keep current status and return OK.
      console.log(`Non-terminal event ${result} for payment ${payment.id}, keeping pending status`);
      return res.status(200).json({
        success: true,
        status: payment.status,
        payment_id: payment.id,
        message: 'Event logged; payment status maintained',
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
