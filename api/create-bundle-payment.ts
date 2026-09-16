import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nrioqyolqusiexgpxfxz.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaW9xeW9scXVzaWV4Z3B4Znh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTUyOTAsImV4cCI6MjA4NDIzMTI5MH0.Uz6aoBl2kjTKENXw8eTrSdOM4W93RVuWTDWr1fCLpAo';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  // CORS
  const origin = req.headers?.origin || req.headers?.Origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, apikey, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: missing authorization token' });
    }

    // Verify authenticated user
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    const user = userData.user;
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const {
      bundleId,
      bundleTitle,
      bundleTitleAr,
      amount,
      courseIds = [],
      paymentPlan = 'full',
      installmentMonths = 1,
      origin: clientOrigin,
    } = body;

    const finalAmount = Number(amount);
    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const displayTitle = bundleTitleAr || bundleTitle || 'Course Bundle';

    // 1. Create guaranteed authoritative custom_course_requests row with SERVICE ROLE KEY
    // This bypasses any RLS hurdles and guarantees create-alinma-payment has an authoritative price
    const { data: requestRow, error: reqErr } = await supabaseAdmin
      .from('custom_course_requests')
      .insert({
        user_id: user.id,
        title: displayTitle,
        description: `باقة دورات: ${displayTitle}`,
        delivery_method: 'recorded',
        status: 'pending',
        final_price: finalAmount,
        estimated_price: finalAmount,
        course_name: displayTitle,
        institution: 'Josoor',
        specialty: 'Bundle',
        doctor_name: 'Josoor',
        academic_year: 'Current',
        section: 'A',
        notes: JSON.stringify({
          is_bundle: true,
          bundle_id: bundleId,
          bundle_title: displayTitle,
          payment_plan: paymentPlan,
          installment_months: installmentMonths,
          course_ids: courseIds,
        }),
      })
      .select('id')
      .single();

    if (reqErr || !requestRow) {
      console.error('Failed to create tracking request:', reqErr);
      return res.status(500).json({ error: 'Failed to create tracking request record', details: reqErr });
    }

    const trackingRequestId = requestRow.id;

    // 2. Invoke create-alinma-payment edge function with the guaranteed trackingRequestId
    const payload = {
      requestId: trackingRequestId,
      bundleId: bundleId || null,
      bundleTitle: displayTitle,
      userId: user.id,
      customerEmail: user.email,
      amount: finalAmount,
      installmentPercent: paymentPlan === 'monthly' ? installmentMonths : 100,
      planType: paymentPlan === 'monthly' ? 'monthly' : 'chapters',
      origin: clientOrigin || 'https://www.josoorcom.com',
    };

    console.log('Forwarding bundle payment to create-alinma-payment with requestId:', trackingRequestId);

    const edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/create-alinma-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify(payload),
    });

    const edgeData = await edgeRes.json().catch(() => ({}));
    console.log('create-alinma-payment response status:', edgeRes.status, edgeData);

    if (edgeRes.ok && edgeData?.redirect_url) {
      return res.status(200).json({
        success: true,
        redirect_url: edgeData.redirect_url,
        order_id: edgeData.order_id,
        payment_id: edgeData.payment_id,
        request_id: trackingRequestId,
      });
    }

    // If edge returned an error
    return res.status(edgeRes.status >= 400 ? edgeRes.status : 502).json({
      error: edgeData?.error || 'Failed to initialize bank payment session',
      details: edgeData?.details || edgeData,
      request_id: trackingRequestId,
    });
  } catch (err: any) {
    console.error('Create bundle payment handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
