// Public endpoint that AlinmaPay may call (notification / callback URL).
//
// It does NOT decide whether a payment succeeded. It only forwards what the bank sent,
// unchanged, to the `alinma-webhook` Supabase Edge Function, which owns the authoritative
// logic (matching the payment, signature check, idempotency, enrollment).
//
// IMPORTANT: a missing `result` / `responseCode` must never be treated as success, and this
// handler must never write `paid` to the database itself.

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nrioqyolqusiexgpxfxz.supabase.co';

// Public (anon / publishable) key only. The Edge Function is deployed with verify_jwt = false,
// so the key is optional; it is sent when available.
const PUBLIC_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const ALLOWED_ORIGINS = new Set([
  'https://www.josoorcom.com',
  'https://josoorcom.com',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
]);

export default async function handler(req: any, res: any) {
  // CORS Headers - Restrict to trusted origins
  const origin = req.headers?.origin || req.headers?.Origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
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
    // Parse payload from body and query (JSON or form-encoded)
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        const params = new URLSearchParams(body);
        const obj: Record<string, any> = {};
        params.forEach((v, k) => {
          obj[k] = v;
        });
        body = obj;
      }
    }

    const payload = {
      ...(req.query || {}),
      ...body,
    };

    console.log('Alinma Webhook received payload:', JSON.stringify(payload));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (PUBLIC_KEY) {
      headers.apikey = PUBLIC_KEY;
      headers.Authorization = `Bearer ${PUBLIC_KEY}`;
    }
    // Let the Edge Function see the bank's signature header if it was sent as a header
    const headerSignature = req.headers?.['x-signature'] || req.headers?.signature;
    if (headerSignature) headers['x-signature'] = String(headerSignature);

    const forwardRes = await fetch(`${SUPABASE_URL}/functions/v1/alinma-webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const forwardData = await forwardRes.json().catch(() => ({}));
    console.log('alinma-webhook edge function responded:', forwardRes.status, JSON.stringify(forwardData));

    // Always acknowledge with 200 so the bank does not keep retrying; the real outcome is in
    // the Edge Function response / audit logs.
    return res.status(200).json({
      success: true,
      forwarded: forwardRes.ok,
      status: forwardData?.status,
      payment_id: forwardData?.payment_id,
      message: forwardData?.message || 'Webhook forwarded',
    });
  } catch (error: any) {
    console.error('Webhook forward error:', error);
    return res.status(200).json({
      success: true,
      forwarded: false,
      message: 'Webhook received with warning',
      error: error?.message || 'Unknown error',
    });
  }
}
