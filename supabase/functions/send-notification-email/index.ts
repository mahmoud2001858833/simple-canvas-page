import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "enrollment" | "payment_confirmed" | "course_approved" | "course_rejected";
  to_email: string;
  to_name: string;
  course_title?: string;
  course_title_ar?: string;
  amount?: number;
  rejection_reason?: string;
}

const getEmailContent = (req: EmailRequest) => {
  const brandColor = "#D4AF37";

  const wrapper = (title: string, body: string) => `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px;">
      <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, ${brandColor}, #B8960C); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">josoorcom</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #1a1a1a; margin: 0 0 16px;">${title}</h2>
          ${body}
        </div>
        <div style="padding: 16px 24px; background: #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
          &copy; ${new Date().getFullYear()} josoorcom. All rights reserved.
        </div>
      </div>
    </div>
  `;

  switch (req.type) {
    case "enrollment":
      return {
        subject: `تسجيل جديد في الكورس | New Enrollment - ${req.course_title_ar || req.course_title}`,
        html: wrapper(
          `🎉 تم تسجيلك في الكورس بنجاح!`,
          `<p style="color: #4b5563; line-height: 1.8;">مرحباً <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">تم تسجيلك بنجاح في كورس <strong>"${req.course_title_ar || req.course_title}"</strong>.</p>
           <p style="color: #4b5563; line-height: 1.8;">يمكنك الآن البدء في مشاهدة الدروس من لوحة التحكم الخاصة بك.</p>
           <div style="text-align: center; margin: 24px 0;">
             <a href="https://xbuild.lovable.app/dashboard" style="background: ${brandColor}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">ابدأ التعلم الآن</a>
           </div>`
        ),
      };

    case "payment_confirmed":
      return {
        subject: `تأكيد الدفع | Payment Confirmed - ${req.amount} SAR`,
        html: wrapper(
          `✅ تم تأكيد دفعتك بنجاح`,
          `<p style="color: #4b5563; line-height: 1.8;">مرحباً <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">تم تأكيد دفعتك بمبلغ <strong>${req.amount?.toLocaleString()} ر.س</strong> بنجاح.</p>
           ${req.course_title_ar ? `<p style="color: #4b5563;">الكورس: <strong>${req.course_title_ar}</strong></p>` : ''}
           <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
             <p style="color: #166534; margin: 0;">✅ تم الدفع بنجاح - يمكنك الوصول للكورس الآن</p>
           </div>`
        ),
      };

    case "course_approved":
      return {
        subject: `تمت الموافقة على كورسك | Course Approved - ${req.course_title_ar || req.course_title}`,
        html: wrapper(
          `🎊 تمت الموافقة على كورسك!`,
          `<p style="color: #4b5563; line-height: 1.8;">مرحباً <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">تمت الموافقة على كورسك <strong>"${req.course_title_ar || req.course_title}"</strong> وهو الآن متاح للطلاب.</p>
           <div style="text-align: center; margin: 24px 0;">
             <a href="https://xbuild.lovable.app/instructor-dashboard" style="background: ${brandColor}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">عرض لوحة التحكم</a>
           </div>`
        ),
      };

    case "course_rejected":
      return {
        subject: `تم رفض الكورس | Course Rejected - ${req.course_title_ar || req.course_title}`,
        html: wrapper(
          `❌ تم رفض كورسك`,
          `<p style="color: #4b5563; line-height: 1.8;">مرحباً <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">للأسف، تم رفض كورسك <strong>"${req.course_title_ar || req.course_title}"</strong>.</p>
           ${req.rejection_reason ? `
           <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
             <p style="color: #991b1b; margin: 0;"><strong>سبب الرفض:</strong> ${req.rejection_reason}</p>
           </div>` : ''}
           <p style="color: #4b5563;">يمكنك تعديل الكورس وإعادة إرساله للمراجعة.</p>`
        ),
      };

    default:
      return { subject: "Notification", html: "<p>Notification</p>" };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailReq: EmailRequest = await req.json();

    if (!emailReq.to_email || !emailReq.type) {
      throw new Error("Missing required fields: to_email, type");
    }

    const content = getEmailContent(emailReq);

    const emailResponse = await resend.emails.send({
      from: "josoorcom <noreply@josoorcom.com>",
      to: [emailReq.to_email],
      subject: content.subject,
      html: content.html,
    });

    console.log("Notification email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
