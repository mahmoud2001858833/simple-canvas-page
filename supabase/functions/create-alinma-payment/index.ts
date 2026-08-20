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

    const { amount, courseId, requestId, userId, customerEmail, couponCode, installmentPercent, planType } =
      body as Record<string, unknown>;
    const uid = String(userId || "").trim();
    const cid = typeof courseId === "string" && courseId.trim() ? courseId.trim() : null;
    const rid = typeof requestId === "string" && requestId.trim() ? requestId.trim() : null;
    const email = String(customerEmail || "").trim();
    const coupon = typeof couponCode === "string" && couponCode.trim() ? couponCode.trim() : null;
    const targetPercent = Number(installmentPercent) > 0 ? Math.min(100, Number(installmentPercent)) : 100;
    const isMonthlyPlan = String(planType || "") === "monthly";

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

    // Resolve amount & title (server-side authoritative pricing)
    let actualAmount = 0;
    let itemTitle = "Payment";
    let currentPaidPercent = 0;

    let monthlyPlanMeta: Record<string, unknown> | null = null;

    if (cid) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, title, price, is_active, monthly_installment_enabled, monthly_installment_months")
        .eq("id", cid)
        .single();

      if (!course) return json({ error: "Course not found" }, 404);
      if (!course.is_active) return json({ error: "Course not available" }, 400);
      if (course.price == null) return json({ error: "Course price is invalid" }, 400);

      const { data: existing } = await supabase
        .from("enrollments")
        .select("id, paid_percentage")
        .eq("user_id", uid)
        .eq("course_id", cid)
        .maybeSingle();

      currentPaidPercent = Number(existing?.paid_percentage ?? 0);
      itemTitle = course.title;

      if (isMonthlyPlan) {
        if (!course.monthly_installment_enabled) {
          return json({ error: "Monthly installments not enabled for this course" }, 400);
        }
        const totalMonths = Math.max(2, Number(course.monthly_installment_months || 3));

        const { data: plan } = await supabase
          .from("monthly_installments")
          .select("months_paid, status")
          .eq("user_id", uid)
          .eq("course_id", cid)
          .maybeSingle();

        const monthsPaid = Number(plan?.months_paid ?? 0);
        if (plan?.status === "completed" || monthsPaid >= totalMonths) {
          return json({ error: "Already enrolled in this course" }, 400);
        }
        // Block starting a monthly plan on top of a partially paid chapter-based enrollment
        if (monthsPaid === 0 && currentPaidPercent > 0) {
          return json({ error: "Invalid installment selection" }, 400);
        }

        actualAmount = Math.ceil(Number(course.price) / totalMonths);
        monthlyPlanMeta = {
          type: "monthly",
          total_months: totalMonths,
          month_number: monthsPaid + 1,
          total_amount: Number(course.price),
          new_paid_percentage: 100,
        };
      } else {
        // Fully paid enrollment cannot pay again
        if (existing && currentPaidPercent >= 100) {
          return json({ error: "Already enrolled in this course" }, 400);
        }
        if (targetPercent <= currentPaidPercent) {
          return json({ error: "Invalid installment selection" }, 400);
        }

        actualAmount = Math.ceil(Number(course.price) * ((targetPercent - currentPaidPercent) / 100));
      }
    } else if (rid) {
      const { data: request } = await supabase
        .from("custom_course_requests")
        .select("id, title, final_price, estimated_price")
        .eq("id", rid)
        .single();

      if (!request) return json({ error: "Request not found" }, 404);
      const rp = request.final_price ?? request.estimated_price;
      if (rp == null) return json({ error: "Request price is invalid" }, 400);
      actualAmount = Number(rp);
      itemTitle = request.title;
    }

    // Apply coupon server-side so the gateway charges the discounted amount
    let couponId: string | null = null;
    let discountAmount = 0;
    if (coupon) {
      const { data: couponResult } = await supabase.rpc("validate_coupon", {
        p_code: coupon,
        p_user_id: uid,
        p_course_id: cid,
        p_order_amount: actualAmount,
      });
      const cr = couponResult as Record<string, unknown> | null;
      if (cr?.valid) {
        couponId = String(cr.coupon_id);
        discountAmount = Number(cr.discount_amount || 0);
        actualAmount = Math.max(0, actualAmount - discountAmount);
      } else {
        return json({ error: "Invalid coupon", details: String(cr?.error_ar || cr?.error || "") }, 400);
      }
    }

    if (!(actualAmount > 0)) {
      return json({ error: "Invalid payment amount" }, 400);
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
        notes: [
          `AlinmaPay - ${itemTitle}`,
          coupon ? `Coupon: ${coupon} (-${discountAmount} SAR)` : null,
          cid
            ? (monthlyPlanMeta
              ? `Monthly installment: month ${monthlyPlanMeta.month_number} of ${monthlyPlanMeta.total_months}`
              : `Installment: ${targetPercent}% (paid before: ${currentPaidPercent}%)`)
            : null,
        ].filter(Boolean).join(" | "),
        installment_plan: cid
          ? (monthlyPlanMeta ?? {
            installment_percent: targetPercent,
            new_paid_percentage: targetPercent,
            is_continuation: currentPaidPercent > 0,
          })
          : null,
      })
      .select()
      .single();

    if (payErr || !payment) {
      console.error("Payment record error:", payErr);
      return json({ error: "Failed to create payment record" }, 500);
    }

    // Reserve coupon usage for this payment
    if (couponId) {
      const { data: used } = await supabase.rpc("use_coupon", {
        p_coupon_id: couponId,
        p_user_id: uid,
        p_payment_id: payment.id,
        p_discount_amount: discountAmount,
      });
      if (used === false) {
        await supabase.from("payments").update({ status: "failed", notes: "Coupon no longer valid" }).eq("id", payment.id);
        return json({ error: "Coupon no longer valid" }, 400);
      }
    }

    // Build EXACT Postman payload
    // AlinmaPay rejects transactions whose IP resolves to a "negative country".
    // Always present a Saudi merchant IP (configurable) instead of the raw client IP.
    const merchantIp = (Deno.env.get("ALINMA_MERCHANT_IP") || "").trim() || "212.118.0.1";
    const clientIp = merchantIp;
    const rawClientIp = extractClientIp(req);
    console.log("Client IP (raw):", rawClientIp, "-> sent IP:", merchantIp);
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

    // Server-to-server notification so the payment is confirmed even if the
    // customer never returns to the receipt page.
    const callbackUrl = `${supabaseUrl}/functions/v1/alinma-webhook`;

    const gatewayPayload: Record<string, unknown> = {
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
      callbackUrl,
      notificationUrl: callbackUrl,
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

    const postGateway = async (payload: Record<string, unknown>) => {
      const r = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      return { status: r.status, text: await r.text() };
    };

    let { status: gwStatus, text: rawText } = await postGateway(gatewayPayload);

    // Some gateway profiles reject unknown fields — retry once without the
    // callback keys so payment creation never breaks because of them.
    if (gwStatus >= 400 || /callbackUrl|notificationUrl|Missing mandatory|unknown field/i.test(rawText)) {
      const { callbackUrl: _c, notificationUrl: _n, ...fallbackPayload } = gatewayPayload;
      console.warn("Retrying gateway request without callback fields");
      const retry = await postGateway(fallbackPayload);
      if (retry.status < 400) {
        gwStatus = retry.status;
        rawText = retry.text;
      }
    }

    console.log("Response status:", gwStatus);
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
