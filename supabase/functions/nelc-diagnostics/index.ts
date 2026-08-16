// NELC / FutureX connectivity diagnostics.
// Runs, from the same server that sends xAPI statements, the exact checks NELC
// asked for so the admin can tell an IP-level block apart from a client
// signature (User-Agent) block, and can report the outgoing public IP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABOUT_URL = "https://lrs.nelc.gov.sa/lrs-license-stg/xapi/about";
const TRACE_URL = "https://lrs.nelc.gov.sa/cdn-cgi/trace";

const LMS_URL = (Deno.env.get("NELC_PLATFORM_URL") ?? "https://josoorcom.com").replace(/\/+$/, "");
const PLATFORM_KEY = Deno.env.get("NELC_PLATFORM_KEY") ?? LMS_URL;
const LRS_ENDPOINT = Deno.env.get("NELC_LRS_ENDPOINT") ?? "";
const USER_AGENT =
  Deno.env.get("NELC_USER_AGENT") ?? "JosoorcomLMS/1.0 (+https://josoorcom.com; xAPI-client)";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extracts the Cloudflare block-page markers NELC referred to. */
function readBlockMarkers(text: string) {
  const rayId = text.match(/Ray ID:?\s*<?[^>]*>?\s*([a-f0-9]{10,})/i)?.[1] ?? null;
  const errorCode = text.match(/[Ee]rror\s*code:?\s*<?[^>]*>?\s*(\d{3,5})/)?.[1] ??
    text.match(/errorCode"?\s*[:=]\s*"?(\d{3,5})/)?.[1] ?? null;
  // NELC's block page prints "Your IP: …" — it may be IPv4 or IPv6.
  const blockedIp = text.match(/Your IP:?\s*<?[^>]*>?\s*([0-9a-f:.]{7,45})/i)?.[1] ??
    text.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/)?.[1] ?? null;
  const blocked = /you have been blocked/i.test(text);
  return { rayId, errorCode, blockedIp, blocked };
}


async function probe(url: string, userAgent?: string) {
  const headers: Record<string, string> = { Accept: "*/*" };
  if (userAgent) headers["User-Agent"] = userAgent;
  try {
    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    return {
      url,
      userAgent: userAgent ?? "(runtime default)",
      status: res.status,
      ok: res.ok,
      body: text.slice(0, 1200),
      ...readBlockMarkers(text),
    };
  } catch (e) {
    return {
      url,
      userAgent: userAgent ?? "(runtime default)",
      status: 0,
      ok: false,
      body: `NETWORK_ERROR: ${String((e as Error).message ?? e)}`,
      rayId: null,
      errorCode: null,
      blockedIp: null,
      blocked: false,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // 1) Credential-free reachability check + 2) outgoing IP + 3) control probe
    const [about, trace, aboutDefaultUa] = await Promise.all([
      probe(ABOUT_URL, USER_AGENT),
      probe(TRACE_URL, USER_AGENT),
      probe(ABOUT_URL),
    ]);

    const outgoingIp = trace.body.match(/(?:^|\n)ip=([^\n]+)/)?.[1]?.trim() ?? null;

    let verdict: string;
    if (about.status === 200) {
      verdict =
        "الحافة تسمح لخادمنا بالمرور — لا يوجد حجب على مستوى عنوان IP. أي 403 لاحق سببه بيانات الاعتماد أو التسجيل وليس الشبكة.";
    } else if (about.errorCode === "1010") {
      verdict = "الحجب بسبب توقيع العميل (User-Agent) — رمز الخطأ 1010.";
    } else if (about.blocked || about.rayId) {
      verdict = "صفحة حجب Cloudflare بدون رمز خطأ — الحجب على مستوى عنوان IP.";
    } else {
      verdict = `رد غير متوقع من نقطة الفحص: HTTP ${about.status}.`;
    }

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      platformUrl: LMS_URL,
      platformKey: PLATFORM_KEY,
      lrsEndpoint: LRS_ENDPOINT || "(غير مضبوط)",
      userAgent: USER_AGENT,
      outgoingIp,
      about,
      aboutWithDefaultUserAgent: aboutDefaultUa,
      trace: { status: trace.status, body: trace.body },
      verdict,
    });
  } catch (e) {
    console.error("nelc-diagnostics error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
