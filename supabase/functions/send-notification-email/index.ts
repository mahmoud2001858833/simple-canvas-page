import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 
    | "enrollment" 
    | "payment_confirmed" 
    | "course_approved" 
    | "course_rejected"
    | "teacher_welcome"
    | "teacher_policy_confirmed"
    | "teacher_offer_sent"
    | "teacher_offer_agreed";
  to_email: string;
  to_name: string;
  course_title?: string;
  course_title_ar?: string;
  amount?: number;
  rejection_reason?: string;
  contract_url?: string;
  offer_details?: string;
  fixed_amount?: number;
  percentage_rate?: number;
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

    case "teacher_welcome":
      return {
        subject: `مرحباً بك في كادر معلمي منصة جسوركم | Welcome to Josoorcom Teaching Faculty`,
        html: wrapper(
          `🎓 تهانينا بانضمامك لكادر التدريس في جسوركم!`,
          `<p style="color: #4b5563; line-height: 1.8;">مرحباً بك الأستاذ الفاضل <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">يسرنا ويشرفنا انضمامك إلى نخبة الكادر الأكاديمي في منصة "جسوركم". رؤيتنا هي تمكين التعليم الجامعي النوعي والوصول إلى آلاف الطلاب المتميزين.</p>
           <p style="color: #4b5563; line-height: 1.8;">يرجى التكرم بالدخول لاستكمال بياناتك البنكية، الاطلاع على المصادر التعليمية وقالب الشرح، وتوثيق توقيعك على سياسات المنصة لبدء نشر دوراتك فوراً.</p>
           <div style="text-align: center; margin: 28px 0;">
             <a href="https://www.josoorcom.com/teacher/onboarding" style="background: ${brandColor}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">إكمال ملف المعلم والتوقيع الرقمي</a>
           </div>
           <p style="color: #64748b; font-size: 13px; text-align: center;">فريق جسوركم الأكاديمي دائماً في خدمتك لدعم نجاحك.</p>`
        ),
      };

    case "teacher_policy_confirmed":
      return {
        subject: `تم اعتماد اتفاقية انضمامك رسمياً | Policy Agreement Confirmed - Josoorcom`,
        html: wrapper(
          `📜 تم توثيق واعتماد اتفاقية التدريس رسمياً`,
          `<p style="color: #4b5563; line-height: 1.8;">الأستاذ الكريم <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">نحيطكم علماً بأنه تم توثيق توقيعكم الرقمي على السياسات والمعايير الأكاديمية بنجاح وأصبحتم رسمياً معلماً معتمداً في منصة جسوركم.</p>
           <p style="color: #4b5563; line-height: 1.8;">الخطوة التالية هي تحديد وتأكيد نموذج توزيع الأرباح المالي الخاص بدوراتك.</p>
           <div style="text-align: center; margin: 28px 0;">
             <a href="https://www.josoorcom.com/teacher/payout-setup" style="background: ${brandColor}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">تحديد نموذج الأرباح المالي</a>
           </div>`
        ),
      };

    case "teacher_offer_sent":
      return {
        subject: `عرض مالي جديد من إدارة جسوركم | Payout Offer from Josoorcom`,
        html: wrapper(
          `💼 عرض مالي مقترح من إدارة المنصة`,
          `<p style="color: #4b5563; line-height: 1.8;">الأستاذ <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">حددت إدارة منصة جسوركم العرض المالي الخاص بك لدوراتك:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
             ${req.fixed_amount ? `<p style="margin: 6px 0; color: #0f172a;"><strong>المبلغ المقطوع:</strong> ${req.fixed_amount} ر.س</p>` : ''}
             ${req.percentage_rate ? `<p style="margin: 6px 0; color: #0f172a;"><strong>نسبة المبيعات:</strong> ${req.percentage_rate}%</p>` : ''}
             ${req.offer_details ? `<p style="margin: 8px 0 0; color: #475569; font-size: 14px;"><strong>رسالة الإدارة:</strong> ${req.offer_details}</p>` : ''}
           </div>
           <p style="color: #4b5563; line-height: 1.8;">يمكنك مراجعة العرض والموافقة عليه أو تقديم عرض مقابل (Counter-Offer) عبر غرفة المفاوضة المباشرة في لوحة تحكمك.</p>
           <div style="text-align: center; margin: 28px 0;">
             <a href="https://www.josoorcom.com/instructor" style="background: ${brandColor}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">دخول غرفة المفاوضة والرد على العرض</a>
           </div>`
        ),
      };

    case "teacher_offer_agreed":
      return {
        subject: `تهانينا! تم اعتماد الاتفاق المالي النهائي | Payout Agreement Finalized`,
        html: wrapper(
          `🎉 تم اعتماد وتفعيل الاتفاق المالي بنجاح!`,
          `<p style="color: #4b5563; line-height: 1.8;">الأستاذ الفاضل <strong>${req.to_name}</strong>،</p>
           <p style="color: #4b5563; line-height: 1.8;">يسرنا إبلاغك بأن الاتفاق المالي قد تم اعتماده وتفعيله رسمياً من قبل الإدارة، وتمت مزامنة دفتر الحسابات تلقائياً.</p>
           <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 20px 0;">
             ${req.fixed_amount ? `<p style="margin: 6px 0; color: #166534;"><strong>المبلغ المقطوع المعتمد:</strong> ${req.fixed_amount} ر.س</p>` : ''}
             ${req.percentage_rate ? `<p style="margin: 6px 0; color: #166534;"><strong>نسبة العمولة المعتمدة:</strong> ${req.percentage_rate}%</p>` : ''}
           </div>
           <p style="color: #4b5563; line-height: 1.8;">حسابك الآن نشط بالكامل، ويمكنك البدء في رفع الدروس ومتابعة مبيعات وأرباح طلابك فوراً.</p>
           <div style="text-align: center; margin: 28px 0;">
             <a href="https://www.josoorcom.com/instructor" style="background: ${brandColor}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">دخول لوحة تحكم المعلم</a>
           </div>`
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
    // AuthN: accept only service-role callers (invoked from other edge functions)
    // or authenticated users. Reject anonymous callers.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isService = !!token && !!serviceRoleKey && token === serviceRoleKey;

    if (!isService) {
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceRoleKey,
      );
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

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
