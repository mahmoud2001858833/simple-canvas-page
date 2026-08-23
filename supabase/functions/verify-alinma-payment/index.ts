// Verifies an AlinmaPay transaction directly with the gateway (status inquiry)
// and closes the local payment record as paid / failed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BASE = (Deno.env.get("ALINMA_API_URL") || "https://pg.alinmapay.com.sa").trim().replace(/\/+$/, "");

const INQUIRY_PATHS = [
  "/Transactions/v2/payments/transaction-status",
  "/Transactions/v2/payments/inquiry",
  "/Transactions/v2/payments/status",
];

const FAILURE_CODES = new Set([
  "201", "202", "205", "209", "218", "220", "223", "225", "259",
  "301", "304", "401", "402", "403", "501", "502", "503", "504", "505", "601",
]);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Outcome = { status: "paid" | "failed" | "unknown"; description: string; raw?: unknown };

function classify(parsed: Record<string, unknown>): Outcome {
  const result = String(parsed.result || parsed.status || "").toUpperCase();
  const code = String(parsed.responseCode ?? "").trim();
  const description = String(
    parsed.responseDescription || parsed.reason || parsed.message || result || code || "",
  );

  if (result === "SUCCESS" || result === "SUCCESSFUL" || result === "CAPTURED" || result === "PAID") {
    return { status: "paid", description: description || "Payment successful", raw: parsed };
  }
  if (result === "FAILURE" || result === "UNSUCCESSFUL" || result === "TIMEOUT" || result === "DECLINED" || result === "CANCELED" || result === "CANCELLED") {
    return { status: "failed", description: description || result, raw: parsed };
  }
  if (code === "0" || code === "00" || code === "000" || code === "1" || code === "001") {
    return { status: "paid", description: description || "Payment successful", raw: parsed };
  }
  if (code && FAILURE_CODES.has(code)) {
    return { status: "failed", description: description || `Response code ${code}`, raw: parsed };
  }
  return { status: "unknown", description: description || "No conclusive gateway status", raw: parsed };
}

// Classifies the query/body parameters AlinmaPay appends to the receipt (return)
// URL after the customer finishes the hosted payment page. This is the primary
// confirmation channel when the server-to-server inquiry API is unavailable.
async function classifyReturnParams(
  params: Record<string, unknown>,
  payment: { transaction_id?: string | null; tabby_payment_id?: string | null; amount: number },
): Promise<Outcome> {
  const get = (...keys: string[]) => {
    for (const k of Object.keys(params)) {
      if (keys.some((key) => key.toLowerCase() === k.toLowerCase())) {
        const v = params[k];
        if (v !== undefined && v !== null && String(v).length > 0) return String(v);
      }
    }
    return "";
  };

  const result = get("result", "status", "paymentStatus").toUpperCase();
  const code = get("responseCode", "response_code", "respCode", "code").trim();
  const description = get("responseDescription", "reason", "message") || result || code;
  const trackId = get("trackId", "trackid", "orderId", "order_id", "merchantOrderId");
  const gatewayTxn = get("transactionId", "paymentId", "tranId");
  const signature = get("signature", "hash");

  if (!result && !code) return { status: "unknown", description: "No return parameters" };

  // The return must belong to this payment.
  const belongs =
    (!!trackId && !!payment.transaction_id && trackId === String(payment.transaction_id)) ||
    (!!gatewayTxn && !!payment.tabby_payment_id && gatewayTxn === String(payment.tabby_payment_id));

  if (!belongs) {
    return { status: "unknown", description: "Return parameters do not match this payment" };
  }

  const success =
    result === "SUCCESS" || result === "SUCCESSFUL" || result === "PAID" || result === "CAPTURED" ||
    ["0", "00", "000", "1", "001"].includes(code);
  const failure =
    result === "FAILURE" || result === "UNSUCCESSFUL" || result === "TIMEOUT" ||
    result === "DECLINED" || result === "CANCELED" || result === "CANCELLED" ||
    (!!code && FAILURE_CODES.has(code));

  if (failure) return { status: "failed", description: description || "Payment declined" };
  if (!success) return { status: "unknown", description: description || "Inconclusive return status" };

  // When the gateway signs the return, the signature must verify.
  const merchantKey = (Deno.env.get("ALINMA_MERCHANT_KEY") || "").trim();
  if (signature && merchantKey && (gatewayTxn || trackId)) {
    const expected = await sha256Hex(
      `${gatewayTxn || trackId}|${merchantKey}|${code}|${Number(payment.amount).toFixed(2)}`,
    );
    if (expected.toLowerCase() !== signature.toLowerCase()) {
      console.warn("Return signature mismatch — ignoring return params");
      return { status: "unknown", description: "Return signature mismatch" };
    }
  }

  return { status: "paid", description: description || "Payment successful (gateway return)" };
}

async function inquire(
  orderId: string,
  transactionId: string | null,
  amount: string,
): Promise<Outcome> {
  const terminalId = (Deno.env.get("ALINMA_TERMINAL_ID") || "").trim();
  const password = (Deno.env.get("ALINMA_TERMINAL_PASSWORD") || "").trim();
  const merchantKey = (Deno.env.get("ALINMA_MERCHANT_KEY") || "").trim();
  if (!terminalId || !password || !merchantKey) {
    return { status: "unknown", description: "Gateway not configured" };
  }

  const signature = await sha256Hex(
    `${orderId}|${terminalId}|${password}|${merchantKey}|${amount}|SAR`,
  );

  const payload: Record<string, unknown> = {
    terminalId,
    password,
    signature,
    amount,
    currency: "SAR",
    order: { orderId },
    orderId,
  };
  if (transactionId) payload.transactionId = transactionId;

  let last: Outcome = { status: "unknown", description: "Gateway inquiry unavailable" };

  for (const path of INQUIRY_PATHS) {
    try {
      const resp = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      console.log(`inquiry ${path} -> ${resp.status}: ${text.slice(0, 800)}`);
      if (resp.status === 404 || resp.status === 405) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      const outcome = classify(parsed);
      last = outcome;
      if (outcome.status !== "unknown") return outcome;
    } catch (e) {
      console.error(`inquiry ${path} error`, e);
    }
  }
  return last;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !anonKey) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await authClient.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
    const reconcileAll = body.reconcileAll === true;

    // ---- Admin bulk reconciliation of stuck pending payments ----
    if (reconcileAll) {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);

      const { data: pendings } = await admin
        .from("payments")
        .select("id, transaction_id, tabby_payment_id, amount, status")
        .eq("status", "pending")
        .eq("payment_method", "online")
        .order("created_at", { ascending: false })
        .limit(100);

      const results: Record<string, unknown>[] = [];
      for (const p of pendings ?? []) {
        if (!p.transaction_id) continue;
        const outcome = await inquire(
          String(p.transaction_id),
          p.tabby_payment_id ? String(p.tabby_payment_id) : null,
          Number(p.amount).toFixed(2),
        );
        if (outcome.status !== "unknown") {
          await admin
            .from("payments")
            .update({
              status: outcome.status,
              paid_at: outcome.status === "paid" ? new Date().toISOString() : null,
              notes: `AlinmaPay inquiry: ${outcome.description}`,
            })
            .eq("id", p.id)
            .eq("status", "pending");
        }
        results.push({ payment_id: p.id, status: outcome.status, description: outcome.description });
      }

      return json({
        success: true,
        checked: results.length,
        paid: results.filter((r) => r.status === "paid").length,
        failed: results.filter((r) => r.status === "failed").length,
        unknown: results.filter((r) => r.status === "unknown").length,
        results,
      });
    }

    // ---- Single payment verification ----
    if (!paymentId) return json({ error: "paymentId is required" }, 400);

    const { data: payment } = await admin
      .from("payments")
      .select("id, user_id, course_id, amount, status, transaction_id, tabby_payment_id, payment_method")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) return json({ error: "Payment not found" }, 404);
    if (payment.user_id !== user.id && !isAdmin) return json({ error: "Forbidden" }, 403);

    if (payment.status !== "pending") {
      return json({ success: true, status: payment.status, already_processed: true });
    }

    const outcome = await inquire(
      String(payment.transaction_id || ""),
      payment.tabby_payment_id ? String(payment.tabby_payment_id) : null,
      Number(payment.amount).toFixed(2),
    );

    if (outcome.status === "unknown") {
      // Online payments must never stay pending: expire stale ones as failed.
      const { data: createdRow } = await admin
        .from("payments")
        .select("created_at")
        .eq("id", payment.id)
        .maybeSingle();
      const createdAt = createdRow?.created_at ? new Date(createdRow.created_at).getTime() : Date.now();
      const ageMinutes = (Date.now() - createdAt) / 60000;
      if (ageMinutes >= 3) {
        await admin
          .from("payments")
          .update({
            status: "failed",
            notes: "Auto-failed: no confirmation from gateway",
          })
          .eq("id", payment.id)
          .eq("status", "pending");
        return json({ success: true, status: "failed", details: "No gateway confirmation" });
      }
      return json({ success: true, status: "pending", details: outcome.description });
    }


    const { error: updErr } = await admin
      .from("payments")
      .update({
        status: outcome.status,
        paid_at: outcome.status === "paid" ? new Date().toISOString() : null,
        notes: `AlinmaPay inquiry: ${outcome.description}`,
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    if (updErr) {
      console.error("payment update error", updErr);
      return json({ error: "Failed to update payment" }, 500);
    }

    if (outcome.status === "paid" && payment.course_id) {
      // trg_finalize_paid_payment already opens the course; notify the student.
      await admin.from("notifications").insert({
        user_id: payment.user_id,
        title: "Payment Successful",
        title_ar: "تم الدفع بنجاح",
        message: "Your payment was confirmed and the course is now active.",
        message_ar: "تم تأكيد الدفع وتفعيل الدورة في حسابك.",
        type: "success",
        link: `/courses/${payment.course_id}`,
      });
    }

    await admin.from("security_audit_logs").insert({
      user_id: payment.user_id,
      action_type: "alinma_inquiry",
      table_name: "payments",
      record_id: payment.id,
      details: { status: outcome.status, description: outcome.description },
    });

    return json({ success: true, status: outcome.status, details: outcome.description });
  } catch (e) {
    console.error("verify-alinma-payment error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
