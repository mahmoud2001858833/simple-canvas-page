// Server-side relay for OpenAI-style chat completions to Gemini 2.5 Flash-Lite.
// Keeps the Google key (GEMINI_API_KEY secret) off the browser. Signed-in users only.
// The response (JSON or SSE stream) is passed back unchanged, so callers parse it as before.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-2.5-flash-lite";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_TOKENS = 8192;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: { message: "Method not allowed" } });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(500, { error: { message: "AI key is not configured on the server" } });

  // Require a real signed-in user (the anon key alone is not enough).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userData } = await auth.auth.getUser(token);
  if (!userData?.user) return json(401, { error: { message: "Sign in required" } });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: { message: "Request too large" } });

  let body: Record<string, any>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: { message: "Invalid JSON" } });
  }
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return json(400, { error: { message: "messages is required" } });
  }

  const payload: Record<string, unknown> = {
    model: MODEL,
    messages: body.messages,
    stream: body.stream === true,
    max_tokens: Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS),
  };
  if (typeof body.temperature === "number") payload.temperature = body.temperature;

  const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: req.signal,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
});
