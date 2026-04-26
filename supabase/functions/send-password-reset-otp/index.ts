import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Email service not configured");

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();
    if (!email) throw new Error("Email is required");

    // Check that user exists and is confirmed
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase() && u.email_confirmed_at
    );

    if (!existingUser) {
      // Don't reveal if email exists or not for security - just say "sent"
      return new Response(
        JSON.stringify({ success: true, message_ar: "إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting - max 3 codes in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentCodes } = await supabase
      .from("email_verification_codes")
      .select("id")
      .eq("email", `reset_${email.toLowerCase()}`)
      .gte("created_at", tenMinutesAgo);

    if (recentCodes && recentCodes.length >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many requests", error_ar: "طلبات كثيرة. يرجى الانتظار." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete old codes
    await supabase
      .from("email_verification_codes")
      .delete()
      .eq("email", `reset_${email.toLowerCase()}`)
      .eq("used", false);

    // Store OTP with "reset_" prefix to differentiate from signup OTPs
    const { error: insertError } = await supabase
      .from("email_verification_codes")
      .insert({
        email: `reset_${email.toLowerCase()}`,
        code: otp,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) throw new Error("Failed to generate code");

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: "josoorcom <noreply@josoorcom.com>",
      to: [email],
      subject: "josoorcom | رمز إعادة تعيين كلمة المرور",
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #10B981, #14B8A6, #059669); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">josoorcom</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">إعادة تعيين كلمة المرور</p>
            </div>
            <div style="padding: 40px 30px; text-align: center;">
              <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 22px;">رمز إعادة تعيين كلمة المرور</h2>
              <p style="color: #6b7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                استخدم هذا الرمز لإعادة تعيين كلمة المرور الخاصة بك
              </p>
              <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 2px dashed #10B981; border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
                <div style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #059669; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
              </div>
              <p style="color: #9ca3af; font-size: 14px; margin: 0;">⏰ صالح لمدة 10 دقائق</p>
            </div>
            <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) throw new Error("Failed to send email");

    console.log(`Password reset OTP sent to ${email}`);

    return new Response(
      JSON.stringify({ success: true, message_ar: "تم إرسال رمز التحقق" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message, error_ar: "فشل في إرسال الرمز" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
