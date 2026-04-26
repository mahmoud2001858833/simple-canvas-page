import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyOtpRequest {
  email: string;
  otp: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, otp }: VerifyOtpRequest = await req.json();

    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ 
          verified: false,
          error: "Invalid OTP format",
          error_ar: "صيغة الرمز غير صحيحة"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find the verification code
    const { data: codes, error: fetchError } = await supabase
      .from("email_verification_codes")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("code", otp)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching verification code:", fetchError);
      throw new Error("Failed to verify code");
    }

    if (!codes || codes.length === 0) {
      // Check if there's an expired code to give better feedback
      const { data: expiredCodes } = await supabase
        .from("email_verification_codes")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("code", otp)
        .eq("used", false)
        .lt("expires_at", new Date().toISOString())
        .limit(1);

      if (expiredCodes && expiredCodes.length > 0) {
        return new Response(
          JSON.stringify({ 
            verified: false,
            error: "Verification code has expired",
            error_ar: "انتهت صلاحية رمز التحقق"
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          verified: false,
          error: "Invalid verification code",
          error_ar: "رمز التحقق غير صحيح"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark the code as used
    const { error: updateError } = await supabase
      .from("email_verification_codes")
      .update({ used: true })
      .eq("id", codes[0].id);

    if (updateError) {
      console.error("Error marking code as used:", updateError);
    }

    // Cleanup old codes for this email
    await supabase
      .from("email_verification_codes")
      .delete()
      .eq("email", email.toLowerCase())
      .neq("id", codes[0].id);

    console.log(`Email ${email} verified successfully`);

    return new Response(
      JSON.stringify({ 
        verified: true,
        message: "Email verified successfully",
        message_ar: "تم التحقق من البريد الإلكتروني بنجاح"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-email-otp:", error);
    return new Response(
      JSON.stringify({ 
        verified: false,
        error: error.message || "Failed to verify code",
        error_ar: "فشل في التحقق من الرمز"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
