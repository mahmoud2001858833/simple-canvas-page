import { createClient } from '@supabase/supabase-js';

// Configuration matching the active Supabase production project
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nrioqyolqusiexgpxfxz.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaW9xeW9scXVzaWV4Z3B4Znh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTUyOTAsImV4cCI6MjA4NDIzMTI5MH0.Uz6aoBl2kjTKENXw8eTrSdOM4W93RVuWTDWr1fCLpAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  // Prevent any CDN or edge caching so every load test request hits Vercel + Supabase
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Only GET is supported for benchmarking.',
    });
  }

  const handlerStart = Date.now();

  try {
    const dbStart = Date.now();

    // Query active courses catalog (read-only, limited to 5 records for benchmark safety)
    const { data, error, count } = await supabase
      .from('courses')
      .select('id, title, category, price, is_active', { count: 'estimated' })
      .eq('is_active', true)
      .limit(5);

    const dbLatency = Date.now() - dbStart;
    const totalLatency = Date.now() - handlerStart;

    if (error) {
      console.error('[Benchmark] Supabase query error:', error);
      return res.status(502).json({
        success: false,
        status: 'database_error',
        error: error.message,
        db_latency_ms: dbLatency,
        total_latency_ms: totalLatency,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      status: 'healthy',
      database: 'connected',
      db_latency_ms: dbLatency,
      total_latency_ms: totalLatency,
      records_retrieved: data?.length || 0,
      total_courses_count: count ?? null,
      region: process.env.VERCEL_REGION || 'edge',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Benchmark] Unexpected handler error:', err);
    return res.status(500).json({
      success: false,
      status: 'server_error',
      error: err?.message || 'Internal Server Error',
      total_latency_ms: Date.now() - handlerStart,
      timestamp: new Date().toISOString(),
    });
  }
}
