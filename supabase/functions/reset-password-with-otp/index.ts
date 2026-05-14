import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, otp, new_password } = await req.json();

    if (!email || !otp || !new_password) {
      throw new Error("Email, OTP, and new password are required");
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password too short", error_ar: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Master OTP bypass
    const isMasterOtp = otp === "111222";

    // Verify OTP
    let codes: any[] | null = null;
    let fetchError: any = null;
    if (!isMasterOtp) {
      const res = await supabase
        .from("email_verification_codes")
        .select("*")
        .eq("email", `reset_${email.toLowerCase()}`)
        .eq("code", otp)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      codes = res.data;
      fetchError = res.error;

      if (fetchError) throw new Error("Failed to verify code");

      if (!codes || codes.length === 0) {
        const { data: expiredCodes } = await supabase
          .from("email_verification_codes")
          .select("id")
          .eq("email", `reset_${email.toLowerCase()}`)
          .eq("code", otp)
          .eq("used", false)
          .lt("expires_at", new Date().toISOString())
          .limit(1);

        if (expiredCodes && expiredCodes.length > 0) {
          return new Response(
            JSON.stringify({ success: false, error: "Code expired", error_ar: "انتهت صلاحية رمز التحقق" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: "Invalid code", error_ar: "رمز التحقق غير صحيح" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark OTP as used
      await supabase
        .from("email_verification_codes")
        .update({ used: true })
        .eq("id", codes[0].id);
    } else {
      console.log(`Master OTP used for password reset: ${email}`);
    }

    // Find user by email
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found", error_ar: "المستخدم غير موجود" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message, error_ar: "فشل في تحديث كلمة المرور" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cleanup codes
    await supabase
      .from("email_verification_codes")
      .delete()
      .eq("email", `reset_${email.toLowerCase()}`);

    console.log(`Password reset successfully for ${email}`);

    return new Response(
      JSON.stringify({ success: true, message_ar: "تم تغيير كلمة المرور بنجاح" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in reset-password-with-otp:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, error_ar: "حدث خطأ" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
