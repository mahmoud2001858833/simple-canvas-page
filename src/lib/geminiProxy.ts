import { supabase } from "@/integrations/supabase/client";

/**
 * Drop-in replacement for
 *   fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", init)
 * that goes through the `gemini-proxy` edge function instead, so no Google key lives in the browser.
 *
 * The request body is the same OpenAI-style JSON; the server forces Gemini 2.5 Flash-Lite and
 * returns the raw response (JSON or SSE stream), so callers parse it exactly as before.
 * Any Authorization header from the caller is replaced with the user's session token.
 * Requires a signed-in user; otherwise it throws, and callers fall back as they already do.
 */
export async function proxyChatFetch(init: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("يجب تسجيل الدخول لاستخدام الذكاء الاصطناعي");

  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: "POST",
    body: init.body,
    signal: init.signal,
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
}
