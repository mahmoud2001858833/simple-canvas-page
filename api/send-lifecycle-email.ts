import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nrioqyolqusiexgpxfxz.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaW9xeW9scXVzaWV4Z3B4Znh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTUyOTAsImV4cCI6MjA4NDIzMTI5MH0.Uz6aoBl2kjTKENXw8eTrSdOM4W93RVuWTDWr1fCLpAo';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const targetEmail = body.to_email || body.toEmail;
    const emailType = body.type;

    if (!targetEmail || !emailType) {
      return res.status(400).json({ error: 'Missing required fields: to_email, type' });
    }

    // 1. Try forwarding to Supabase Edge Function
    try {
      const edgeRes = await supabase.functions.invoke('send-notification-email', {
        body: {
          ...body,
          to_email: targetEmail,
          toEmail: targetEmail,
        },
      });

      if (!edgeRes.error) {
        return res.status(200).json({ success: true, method: 'edge_function', data: edgeRes.data });
      }
    } catch (edgeErr) {
      console.warn('[Vercel API] Edge function invoke failed, attempting direct Resend:', edgeErr);
    }

    // 2. Direct Resend fallback if RESEND_API_KEY is present
    if (RESEND_API_KEY) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'josoorcom <noreply@josoorcom.com>',
          to: [targetEmail],
          subject: body.subject || 'إشعار من منصة جسوركم الأكاديمية',
          html: body.html || `<p dir="rtl">مرحباً ${body.to_name || body.toName || 'أستاذنا'}، لديك إشعار جديد في منصة جسوركم.</p>`,
        }),
      });

      const resendData = await resendRes.json();
      return res.status(200).json({ success: true, method: 'direct_resend', data: resendData });
    }

    return res.status(200).json({ success: true, simulated: true, to: targetEmail });
  } catch (error: any) {
    console.error('[Vercel API] send-lifecycle-email error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
