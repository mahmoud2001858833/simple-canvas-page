import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://pg.alinmapay.com.sa/Transactions/v2/payments/pay-request";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateOrderId(): string {
  const ts = Date.now().toString().slice(-10);
  const rnd = Math.floor(100 + Math.random() * 900).toString();
  return (ts + rnd).slice(0, 15);
}

function fmtAmount(v: number | string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid payment amount");
  return n.toFixed(2);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ascii(v: unknown, fallback = ""): string {
  const cleaned = String(v || "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function safeText(v: unknown, fallback: string, maxLen: number): string {
  const cleaned = ascii(v, fallback).slice(0, maxLen).trim();
  return /[A-Za-z0-9]/.test(cleaned) ? cleaned : fallback;
}

function safeEmail(v: unknown, fallback = "customer@example.com"): string {
  const cleaned = ascii(v, "").toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : fallback;
}

function extractClientIp(req: Request): string {
  const raw = (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    ""
  ).split(",")[0]?.trim() || "";

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return raw;
  return "10.10.10.10";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim();

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Backend configuration missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const terminalId = (Deno.env.get("ALINMA_TERMINAL_ID") || "").trim();
    const password = (Deno.env.get("ALINMA_TERMINAL_PASSWORD") || "").trim();
    const merchantKey = (Deno.env.get("ALINMA_MERCHANT_KEY") || "").trim();

    if (!terminalId || !password || !merchantKey) {
      return json({ error: "Payment gateway not configured" }, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid request body" }, 400);

    const { amount, courseId, requestId, userId, customerEmail } = body as Record<string, unknown>;
    const uid = String(userId || "").trim();
    const cid = typeof courseId === "string" && courseId.trim() ? courseId.trim() : null;
    const rid = typeof requestId === "string" && requestId.trim() ? requestId.trim() : null;
    const email = String(customerEmail || "").trim();

    if (!amount || !uid) {
      return json({ error: "Missing required fields: amount and userId" }, 400);
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !anonKey) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authData.user || authData.user.id !== uid) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", uid)
      .single();
    if (!profile) return json({ error: "User not found" }, 404);

    // Resolve amount & title
    let actualAmount: number | string = amount as number | string;
    let itemTitle = "Payment";

    if (cid) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, title, price, is_active")
        .eq("id", cid)
        .single();

      if (!course) return json({ error: "Course not found" }, 404);
      if (!course.is_active) return json({ error: "Course not available" }, 400);
      if (course.price == null) return json({ error: "Course price is invalid" }, 400);

      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", uid)
        .eq("course_id", cid)
        .maybeSingle();
      if (existing) return json({ error: "Already enrolled in this course" }, 400);

      actualAmount = course.price;
      itemTitle = course.title;
    } else if (rid) {
      const { data: request } = await supabase
        .from("custom_course_requests")
        .select("id, title, final_price, estimated_price")
        .eq("id", rid)
        .single();

      if (!request) return json({ error: "Request not found" }, 404);
      const rp = request.final_price ?? request.estimated_price;
      if (rp == null) return json({ error: "Request price is invalid" }, 400);
      actualAmount = rp;
      itemTitle = request.title;
    }

    // Generate unique orderId & signature
    const orderId = generateOrderId();
    const formattedAmount = fmtAmount(actualAmount);
    const currency = "SAR";

    // Signature: orderId|terminalId|password|merchantKey|amount|currency
    const sigInput = `${orderId}|${terminalId}|${password}|${merchantKey}|${formattedAmount}|${currency}`;
    const signature = await sha256Hex(sigInput);

    console.log("Signature input (masked):", `${orderId}|${terminalId}|***|***|${formattedAmount}|${currency}`);

    // Create payment record
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        user_id: uid,
        course_id: cid,
        request_id: rid,
        amount: Number(actualAmount),
        payment_method: "online",
        status: "pending",
        transaction_id: orderId,
        notes: `AlinmaPay - ${itemTitle}`,
      })
      .select()
      .single();

    if (payErr || !payment) {
      console.error("Payment record error:", payErr);
      return json({ error: "Failed to create payment record" }, 500);
    }

    // Build EXACT Postman payload
    const clientIp = extractClientIp(req);
    // Build return URL — redirect directly to course page after payment
    const siteUrl = "https://www.josoorcom.com";
    const receiptUrl = cid
      ? `${siteUrl}/payment/success?payment_id=${payment.id}&course_id=${cid}`
      : `${siteUrl}/payment/success?payment_id=${payment.id}`;

    const userData = JSON.stringify({
      paymentId: payment.id,
      courseId: cid,
      requestId: rid,
    });

    const gatewayPayload = {
      terminalId,
      password,
      signature,
      paymentType: 1,
      merchantIp: clientIp,
      customerIp: clientIp,
      amount: formattedAmount,
      country: "SA",
      currency,
      order: {
        orderId,
      },
      customer: {
        cardHolderName: safeText(profile.full_name || "", "Customer", 50),
        customerEmail: safeEmail(email || profile.email || ""),
        billingAddressStreet: "",
        billingAddressCountry: "SA",
      },
      receipt: receiptUrl,
      additionalDetails: {
        userData,
      },
    };

    console.log("=== AlinmaPay Request ===");
    console.log("OrderId:", orderId, "Amount:", formattedAmount, currency);
    console.log("Gateway URL:", GATEWAY_URL);
    console.log(
      "Payload (masked):",
      JSON.stringify(gatewayPayload, null, 2)
        .replaceAll(password, "***")
        .replaceAll(merchantKey, "[key]")
        .replaceAll(signature, "[sig]"),
    );

    // Single POST — no retries, no variants
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(gatewayPayload),
    });

    const rawText = await resp.text();
    console.log("Response status:", resp.status);
    console.log("Response body:", rawText.substring(0, 2000));

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    console.log("Parsed response:", JSON.stringify(parsed, null, 2));

    const responseCode = String(parsed.responseCode || "");
    const txnId = String(parsed.transactionId || parsed.paymentId || "");
    const reason = String(parsed.reason || parsed.responseDescription || "Unknown error");
    const result = String(parsed.result || "");

    // Extract redirect URL
    const pl = parsed.paymentLink as Record<string, unknown> | undefined;
    const linkUrl = typeof pl?.linkUrl === "string" ? pl.linkUrl : "";
    const redirectUrl = String(
      parsed.redirectUrl || parsed.url || parsed.paymentPageUrl || parsed.webPaymentUrl ||
      (linkUrl && txnId ? `${linkUrl}${txnId}` : linkUrl) || "",
    );

    // Check success
    const isSuccess = redirectUrl && result !== "FAILURE" && result !== "UnSuccessful";

    if (!isSuccess) {
      console.error("AlinmaPay error:", parsed);
      await supabase
        .from("payments")
        .update({
          status: "failed",
          notes: `AlinmaPay Error: ${responseCode || "UNKNOWN"} - ${reason}`,
        })
        .eq("id", payment.id);

      return json({
        error: "Failed to initialize payment session",
        details: `Response code: ${responseCode || "UNKNOWN"} - ${reason}`,
        responseCode,
        fullResponse: parsed,
      }, 400);
    }

    // Success
    await supabase
      .from("payments")
      .update({
        tabby_payment_id: txnId || null,
        notes: `AlinmaPay: ${txnId || "pending"} | Order: ${orderId} | ${itemTitle}`,
      })
      .eq("id", payment.id);

    await supabase.from("security_audit_logs").insert({
      user_id: uid,
      action_type: "PAYMENT_INITIATED",
      table_name: "payments",
      record_id: payment.id,
      details: {
        amount: Number(actualAmount),
        order_id: orderId,
        transaction_id: txnId || null,
        payment_method: "alinmapay",
        course_id: cid,
        request_id: rid,
      },
    });

    console.log("=== Payment Session Created ===");
    console.log("Transaction ID:", txnId, "Redirect:", redirectUrl);

    return json({
      success: true,
      payment_id: payment.id,
      track_id: orderId,
      transaction_id: txnId || null,
      redirect_url: redirectUrl,
    });
  } catch (error: unknown) {
    console.error("AlinmaPay Error:", error);
    return json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown",
    }, 500);
  }
});
