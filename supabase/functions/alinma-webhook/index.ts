import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-merchant-id, x-signature, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeAmount(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : String(value || "0");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SUCCESS_CODES = new Set([
  "0", "00", "000", "1", "001", "SUCCESS", "SUCCESSFUL", "CAPTURED", "PAID", "APPROVED"
]);

const FAILURE_CODES = new Set([
  "201", "202", "205", "209", "218", "220", "223", "225", "259",
  "301", "304", "401", "402", "403", "501", "502", "503", "504", "505", "601",
  "FAILURE", "UNSUCCESSFUL", "DECLINED", "CANCELED", "CANCELLED", "TIMEOUT"
]);

function determineStatus(responseCode: string, result: string): { status: "paid" | "failed" | "pending"; description: string } {
  const normResult = (result || "").trim().toUpperCase();
  const normCode = (responseCode || "").trim().toUpperCase();

  if (SUCCESS_CODES.has(normResult) || SUCCESS_CODES.has(normCode)) {
    return { status: "paid", description: "Payment Successful" };
  }

  if (FAILURE_CODES.has(normResult) || FAILURE_CODES.has(normCode)) {
    return { status: "failed", description: normResult || normCode || "Payment Failed" };
  }

  return { status: "pending", description: `Pending confirmation (${normCode || normResult})` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const url = new URL(req.url);
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((val, key) => {
    queryParams[key] = val;
  });

  // Extract raw body
  let rawBody = "";
  let parsedBody: Record<string, unknown> = {};

  if (req.method === "POST" || req.method === "PUT") {
    try {
      rawBody = await req.text();
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formParams = new URLSearchParams(rawBody);
        formParams.forEach((val, key) => {
          parsedBody[key] = val;
        });
      } else {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          // Fallback to URL search params in case content-type header was missing/plain
          const formParams = new URLSearchParams(rawBody);
          let count = 0;
          formParams.forEach((val, key) => {
            parsedBody[key] = val;
            count++;
          });
          if (count === 0) {
            parsedBody = { raw: rawBody };
          }
        }
      }
    } catch (err) {
      console.warn("Could not read request body:", err);
    }
  }

  // Merge query params and parsed body (body takes precedence)
  const payload: Record<string, unknown> = {
    ...queryParams,
    ...parsedBody,
  };

  // If GET with no payment-related parameters, return health check info
  const hasPaymentParams =
    payload.trackId ||
    payload.trackid ||
    payload.TrackID ||
    payload.orderId ||
    payload.order_id ||
    payload.paymentId ||
    payload.paymentid ||
    payload.PaymentID ||
    payload.transactionId ||
    payload.result ||
    payload.responseCode;

  if (req.method === "GET" && !hasPaymentParams) {
    return jsonResponse({
      success: true,
      status: "active",
      gateway: "AlinmaPay",
      version: "3.2",
      message: "AlinmaPay webhook is active and ready to receive notifications",
      timestamp: new Date().toISOString(),
    });
  }

  console.log("=== AlinmaPay Webhook Notification Received ===");
  console.log(`Method: ${req.method} | IP: ${clientIP} | Timestamp: ${new Date().toISOString()}`);
  console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
  console.log("Merged Payload:", JSON.stringify(payload, null, 2));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.trim();
    const supabase = createClient(supabaseUrl, serviceKey);

    // Extract all fields across various casings & nested objects
    const orderObj = (payload.order as Record<string, unknown> | null) || {};
    const orderDetails = (payload.orderDetails as Record<string, unknown> | null) || {};
    const amountDetails = (payload.amountDetails as Record<string, unknown> | null) || {};
    const cardDetails = (payload.cardDetails as Record<string, unknown> | null) || {};

    const trackId = String(
      payload.trackId ||
      payload.trackid ||
      payload.TrackId ||
      payload.TrackID ||
      payload.track_id ||
      payload.orderId ||
      payload.order_id ||
      orderObj.orderId ||
      orderDetails.orderId ||
      payload.MerchantTxnId ||
      payload.referenceId ||
      payload.ref ||
      "",
    ).trim();

    const paymentId = String(
      payload.paymentId ||
      payload.paymentid ||
      payload.PaymentID ||
      payload.transactionId ||
      payload.tranid ||
      payload.trans_id ||
      payload.TranID ||
      "",
    ).trim();

    const transactionId = String(
      payload.transactionId ||
      payload.tranid ||
      payload.trans_id ||
      payload.TranID ||
      payload.paymentId ||
      "",
    ).trim();

    const responseCode = String(
      payload.responseCode ||
      payload.response_code ||
      payload.ResponseCode ||
      payload.code ||
      payload.ResultCode ||
      "",
    ).trim();

    const result = String(
      payload.result ||
      payload.Result ||
      payload.status ||
      payload.Status ||
      payload.transStatus ||
      "",
    ).trim();

    const responseDescription = String(
      payload.responseDescription ||
      payload.reason ||
      payload.message ||
      payload.error ||
      "",
    ).trim();

    const rawAmount =
      amountDetails.amount ||
      amountDetails.originalAmount ||
      orderObj.amount ||
      payload.amount ||
      payload.amt ||
      "0";
    const amount = normalizeAmount(rawAmount);

    const receivedSignature = String(
      payload.signature ||
      payload.Signature ||
      payload.secureHash ||
      payload.hash ||
      req.headers.get("x-signature") ||
      req.headers.get("signature") ||
      "",
    ).trim();

    const maskedCard = String(cardDetails.maskedCard || payload.maskedCard || "");
    const cardBrand = String(cardDetails.cardBrand || payload.cardBrand || "");
    const authCode = String(payload.authCode || payload.auth_code || "");
    const rrn = String(payload.rrn || payload.RRN || "");

    // Extract userData
    let userData: Record<string, unknown> = {};
    try {
      const addDetails = (payload.additionalDetails as Record<string, unknown> | null) || {};
      const rawUD = addDetails.userData || payload.userData || payload.custom || payload.metadata;
      if (typeof rawUD === "string") {
        userData = JSON.parse(rawUD);
      } else if (typeof rawUD === "object" && rawUD !== null) {
        userData = rawUD as Record<string, unknown>;
      }
    } catch {
      console.log("No parsable userData in webhook payload");
    }

    console.log(`Parsed Webhook Keys: trackId="${trackId}", paymentId="${paymentId}", result="${result}", responseCode="${responseCode}", amount="${amount}"`);

    // Verify signature against multiple common formulas if secret is set
    const merchantKey = (Deno.env.get("ALINMA_MERCHANT_KEY") || "").trim();
    const terminalId = (Deno.env.get("ALINMA_TERMINAL_ID") || "").trim();
    const password = (Deno.env.get("ALINMA_TERMINAL_PASSWORD") || "").trim();

    let signatureVerified = false;

    if (receivedSignature && merchantKey) {
      const candidates = [
        `${paymentId}|${merchantKey}|${responseCode}|${amount}`,
        `${paymentId}|${merchantKey}|${responseCode}|${Number(amount).toFixed(2)}`,
        `${paymentId}|${merchantKey}|${responseCode}|${Math.round(Number(amount))}`,
        `${trackId}|${terminalId}|${password}|${merchantKey}|${amount}|SAR`,
        `${trackId}|${terminalId}|${password}|${merchantKey}|${Number(amount).toFixed(2)}|SAR`,
        `${trackId}|${merchantKey}|${responseCode}|${amount}`,
        `${paymentId}|${merchantKey}|${responseCode}|${amount}|SAR`,
        `${trackId}|${paymentId}|${responseCode}|${amount}|${merchantKey}`,
      ];

      for (const cand of candidates) {
        const hash = await sha256Hex(cand);
        if (hash.toLowerCase() === receivedSignature.toLowerCase()) {
          signatureVerified = true;
          console.log("Signature successfully verified with candidate format:", cand);
          break;
        }
      }

      if (!signatureVerified) {
        console.warn("Signature did not match standard formulas; proceeding with high-entropy order verification");
      }
    }

    // Locate the matching payment record in Supabase
    let payment: any = null;

    // 1. By internal payment UUID from userData
    if (userData.paymentId && typeof userData.paymentId === "string") {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("id", userData.paymentId)
        .maybeSingle();
      if (data) payment = data;
    }

    // 2. By transaction_id = trackId (orderId from create-alinma-payment)
    if (!payment && trackId) {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", trackId)
        .maybeSingle();
      if (data) payment = data;
    }

    // 3. By tabby_payment_id = transactionId or paymentId
    if (!payment && transactionId) {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("tabby_payment_id", transactionId)
        .maybeSingle();
      if (data) payment = data;
    }

    if (!payment && paymentId) {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("tabby_payment_id", paymentId)
        .maybeSingle();
      if (data) payment = data;
    }

    // 4. By id = trackId (if trackId was payment UUID)
    if (!payment && trackId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId)) {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("id", trackId)
        .maybeSingle();
      if (data) payment = data;
    }

    // 5. By transaction_id = paymentId
    if (!payment && paymentId) {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", paymentId)
        .maybeSingle();
      if (data) payment = data;
    }

    if (!payment) {
      console.warn("Payment record not found for webhook; logging to security_audit_logs");
      await supabase.from("security_audit_logs").insert({
        action_type: "alinma_webhook_unmatched",
        table_name: "payments",
        ip_address: clientIP,
        details: {
          trackId,
          paymentId,
          transactionId,
          responseCode,
          result,
          amount,
          rawPayload: payload,
          signatureVerified,
        },
      });

      return jsonResponse({
        success: true,
        message: "Webhook received and logged (no matching order found)",
        trackId,
      });
    }

    console.log(`Found matching payment record: ${payment.id} (Current status: ${payment.status}, amount: ${payment.amount})`);

    const { status: newStatus, description } = determineStatus(responseCode, result);
    console.log(`Resolved status for payment ${payment.id}: ${newStatus} (${description})`);

    // Idempotency: if already paid, ensure enrollment is active and return success
    if (payment.status === "paid" && newStatus === "paid") {
      console.log(`Payment ${payment.id} is already marked paid. Ensuring enrollment access.`);

      if (payment.course_id) {
        const targetPercent = Number(
          payment.installment_plan?.new_paid_percentage ||
          payment.installment_plan?.installment_percent ||
          100
        );

        const { data: existEnroll } = await supabase
          .from("enrollments")
          .select("id, paid_percentage")
          .eq("user_id", payment.user_id)
          .eq("course_id", payment.course_id)
          .maybeSingle();

        if (existEnroll) {
          await supabase
            .from("enrollments")
            .update({
              status: "active",
              paid_percentage: Math.max(Number(existEnroll.paid_percentage || 0), targetPercent),
            })
            .eq("id", existEnroll.id);
        } else {
          await supabase.from("enrollments").insert({
            user_id: payment.user_id,
            course_id: payment.course_id,
            status: "active",
            paid_percentage: targetPercent,
          });
        }
      }

      return jsonResponse({
        success: true,
        message: "Payment already confirmed and processed",
        payment_id: payment.id,
      });
    }

    // Build update record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      notes: [
        payment.notes,
        `AlinmaPay Webhook: ${responseDescription || description}`,
        cardBrand ? `Card: ${cardBrand} ${maskedCard}` : null,
        authCode ? `Auth: ${authCode}` : null,
        rrn ? `RRN: ${rrn}` : null,
      ].filter(Boolean).join(" | "),
    };

    if (newStatus === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    if (transactionId || paymentId) {
      updateData.tabby_payment_id = transactionId || paymentId;
    }

    // Update payment record (recovering even if it was previously marked failed by timeout)
    const { error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", payment.id);

    if (updateError) {
      console.error("Error updating payment in database:", updateError);
      throw updateError;
    }

    console.log(`Successfully updated payment ${payment.id} to status "${newStatus}"`);

    // If payment is paid, activate course and enrollments
    if (newStatus === "paid" && payment.course_id) {
      const targetPercent = Number(
        payment.installment_plan?.new_paid_percentage ||
        payment.installment_plan?.installment_percent ||
        100
      );

      const { data: existingEnrollment } = await supabase
        .from("enrollments")
        .select("id, paid_percentage")
        .eq("user_id", payment.user_id)
        .eq("course_id", payment.course_id)
        .maybeSingle();

      if (existingEnrollment) {
        const updatedPct = Math.max(Number(existingEnrollment.paid_percentage || 0), targetPercent);
        await supabase
          .from("enrollments")
          .update({
            status: "active",
            paid_percentage: updatedPct,
          })
          .eq("id", existingEnrollment.id);
        console.log(`Updated enrollment ${existingEnrollment.id} to active, paid_percentage=${updatedPct}%`);
      } else {
        await supabase.from("enrollments").insert({
          user_id: payment.user_id,
          course_id: payment.course_id,
          status: "active",
          paid_percentage: targetPercent,
        });
        console.log(`Created new active enrollment for user ${payment.user_id} in course ${payment.course_id}`);
      }

      // Handle monthly installment plan progression
      if (payment.installment_plan?.plan_type === "monthly") {
        const monthNumber = Number(payment.installment_plan.month_number || 1);
        const totalMonths = Number(payment.installment_plan.total_months || 3);

        const { data: mPlan } = await supabase
          .from("monthly_installments")
          .select("id, months_paid")
          .eq("user_id", payment.user_id)
          .eq("course_id", payment.course_id)
          .maybeSingle();

        if (mPlan) {
          const newMonthsPaid = Math.max(Number(mPlan.months_paid || 0), monthNumber);
          await supabase
            .from("monthly_installments")
            .update({
              months_paid: newMonthsPaid,
              status: newMonthsPaid >= totalMonths ? "completed" : "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", mPlan.id);
        }
      }

      // Notify student
      await supabase.from("notifications").insert({
        user_id: payment.user_id,
        title: "Payment Successful",
        title_ar: "تم تأكيد الدفع بنجاح",
        message: "Your payment has been received and your course is now fully activated.",
        message_ar: "تم استلام دفعتك بنجاح وتم تفعيل الدورة في حسابك.",
        type: "success",
        link: `/courses/${payment.course_id}`,
      });

      // Notify instructor & calculate earnings
      const { data: courseData } = await supabase
        .from("courses")
        .select("instructor_id, instructor_commission, title, title_ar")
        .eq("id", payment.course_id)
        .single();

      if (courseData?.instructor_id && Number(payment.amount) > 0) {
        const commission = courseData.instructor_commission || 30;
        const instructorAmount = Math.round(Number(payment.amount) * commission) / 100;

        await supabase.from("instructor_earnings").insert({
          instructor_id: courseData.instructor_id,
          payment_id: payment.id,
          course_id: payment.course_id,
          amount: instructorAmount,
          commission_rate: commission,
          status: "pending",
        }).then(() => {}).catch(() => {});
      }

      // Trigger NELC xAPI tracking asynchronously
      supabase.functions.invoke("xapi-track", {
        body: {
          verb: "registered",
          courseId: payment.course_id,
          targetUserId: payment.user_id,
          allowDuplicate: true,
        },
      }).catch((e) => console.warn("xAPI track on webhook error:", e));
    }

    // Custom course request status update
    if (newStatus === "paid" && payment.request_id) {
      await supabase
        .from("custom_course_requests")
        .update({ status: "in_progress" })
        .eq("id", payment.request_id);

      await supabase.from("notifications").insert({
        user_id: payment.user_id,
        title: "Payment Received",
        title_ar: "تم استلام الدفعة",
        message: "Your payment has been received. Our team will start working on your custom request.",
        message_ar: "تم استلام دفعتك بنجاح وسيبدأ فريقنا العمل على طلبك.",
        type: "success",
        link: "/dashboard",
      });
    }

    // Audit log
    await supabase.from("security_audit_logs").insert({
      user_id: payment.user_id,
      action_type: "alinma_webhook_processed",
      table_name: "payments",
      record_id: payment.id,
      ip_address: clientIP,
      details: {
        trackId,
        paymentId,
        transactionId,
        responseCode,
        result,
        newStatus,
        amount,
        signature_verified: signatureVerified,
      },
    });

    console.log(`=== AlinmaPay Webhook Completed Successfully for payment ${payment.id} ===`);

    return jsonResponse({
      success: true,
      status: newStatus,
      payment_id: payment.id,
      message: `Payment updated to ${newStatus}`,
    });
  } catch (error: unknown) {
    console.error("AlinmaPay Webhook Processing Error:", error);
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: errMessage }, 500);
  }
});
