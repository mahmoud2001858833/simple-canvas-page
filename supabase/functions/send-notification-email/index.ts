import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailRequest {
  type: 
    | "enrollment" 
    | "payment_confirmed" 
    | "course_approved" 
    | "course_rejected"
    | "teacher_welcome"
    | "teacher_policy_confirmed"
    | "teacher_bank_submitted"
    | "teacher_payout_submitted"
    | "teacher_offer_sent"
    | "teacher_offer_agreed";
  to_email?: string;
  toEmail?: string;
  to_name?: string;
  toName?: string;
  course_title?: string;
  course_title_ar?: string;
  amount?: number;
  rejection_reason?: string;
  contract_url?: string;
  contractUrl?: string;
  file_url?: string;
  fileUrl?: string;
  file_name?: string;
  fileName?: string;
  offer_details?: string;
  offerDetails?: string;
  fixed_amount?: number;
  fixedAmount?: number;
  percentage_rate?: number;
  percentageRate?: number;
  bank_name?: string;
  bankName?: string;
  iban?: string;
}

const getEmailContent = (req: EmailRequest) => {
  const brandGold = "#D4AF37";
  const brandDark = "#0f172a";
  const recipientName = req.to_name || req.toName || "أستاذنا الفاضل";
  const contractUrl = req.contract_url || req.contractUrl;
  const fileUrl = req.file_url || req.fileUrl || "https://www.josoorcom.com/وثيقة_الاعتماد_الفني_للفيلم_الرسمي_جسوركم.pdf";
  const fileName = req.file_name || req.fileName || "دليل المعلم والمعايير الأكاديمية - منصة جسوركم.pdf";
  const fixedAmount = req.fixed_amount ?? req.fixedAmount;
  const percentageRate = req.percentage_rate ?? req.percentageRate;
  const offerMsg = req.offer_details || req.offerDetails;
  const bankName = req.bank_name || req.bankName || "الحساب المصرفي المعتمد";
  const rawIban = req.iban || "";
  const maskedIban = rawIban.length > 8 ? `${rawIban.substring(0, 4)} **** **** ${rawIban.substring(rawIban.length - 4)}` : rawIban;

  const wrapper = (title: string, body: string, attachmentCard?: boolean) => `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">منصة جسوركم التعليمية</h1>
          <p style="color: #fef3c7; margin: 6px 0 0; font-size: 14px; font-weight: 500;">بوابة التميز والتعليم الجامعي المتخصص</p>
        </div>

        <!-- Body -->
        <div style="padding: 36px 28px; background: #ffffff;">
          <h2 style="color: ${brandDark}; margin: 0 0 18px; font-size: 20px; font-weight: 700; line-height: 1.4;">${title}</h2>
          ${body}

          ${attachmentCard ? `
          <div style="margin-top: 24px; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">📎 الملف والمستند المرفق:</p>
            <p style="margin: 4px 0 12px; font-size: 13px; color: #64748b;">${fileName}</p>
            <a href="${fileUrl}" style="background: #0f172a; color: #ffffff; padding: 8px 18px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; display: inline-block;">تحميل الملف PDF</a>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="padding: 20px 24px; background: #f1f5f9; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 6px;">هذه الرسالة رسمية وموجهة مباشرة من نظام منصة جسوركم الأكاديمي.</p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} منصة جسوركم (Josoorcom). جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </div>
  `;

  switch (req.type) {
    case "teacher_welcome":
      return {
        subject: `مرحباً بك في كادر معلمي منصة جسوركم الأكاديمية | Josoorcom Faculty Welcome`,
        html: wrapper(
          `🎓 تهانينا بانضمامك لكادر التدريس في جسوركم!`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يسرنا ويشرفنا انضمامك إلى نخبة الكادر الأكاديمي في منصة <strong>"جسوركم"</strong>. نسعى معاً لتمكين التعليم الجامعي النوعي وإيصال خبراتك لآلاف الطلاب الجامعيين.</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">مرفق مع هذه الرسالة <strong>دليل المعايير الأكاديمية والوثيقة الفنية للمنصة</strong>. يرجى التكرم بالدخول لاستكمال بياناتك البنكية واعتماد التوقيع الرقمي لبدء إعداد ونشر مقرراتك فوراً.</p>
           <div style="text-align: center; margin: 32px 0;">
             <a href="https://www.josoorcom.com/teacher/onboarding" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px rgba(212,175,55,0.4);">إكمال الملف والتوقيع الرقمي</a>
           </div>
           <p style="color: #64748b; font-size: 13px; text-align: center;">فريق الإدارة الأكاديمية في جسوركم دائماً في خدمتك لدعم نجاحك.</p>`,
          true
        ),
      };

    case "teacher_policy_confirmed":
      return {
        subject: `تم توثيق واعتماد اتفاقية التدريس رسمياً | Policy Confirmed - Josoorcom`,
        html: wrapper(
          `📜 تم توثيق واعتماد اتفاقية التدريس والشروط الأكاديمية`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الكريم <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">نحيطكم علماً بأنه تم توثيق توقيعكم الرقمي على السياسات والمعايير الأكاديمية بنجاح وأصبحتم معلماً معتمداً في منصة جسوركم.</p>
           <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 20px 0;">
             <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">✅ تم إيداع النسخة الموقعة إلكترونياً والمصادقة عليها من قبل المنصة.</p>
             ${contractUrl ? `<p style="margin: 8px 0 0;"><a href="${contractUrl}" style="color: #15803d; text-decoration: underline; font-weight: 700; font-size: 13px;">عرض وتنزيل العقد الرقمي الموثق (PDF)</a></p>` : ''}
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">الخطوة التالية المتبقية هي تحديد وتأكيد <strong>نموذج توزيع الأرباح المالي</strong> الخاص بمقرراتك.</p>
           <div style="text-align: center; margin: 32px 0;">
             <a href="https://www.josoorcom.com/teacher/payout-setup" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px rgba(212,175,55,0.4);">تحديد نموذج الأرباح المالي (الخطوة 2)</a>
           </div>`,
          false
        ),
      };

    case "teacher_bank_submitted":
      return {
        subject: `تم استلام وتوثيق بياناتك البنكية بنجاح | Josoorcom Bank Details`,
        html: wrapper(
          `🏦 تم استلام وتوثيق بيانات حسابك البنكي بنجاح`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">تم استلام وتشفير بيانات حسابك البنكي بنجاح في الإدارة المالية لمنصة جسوركم لإجراء التحويلات الشهرية للأرباح:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
             <p style="margin: 4px 0; color: #1e293b; font-size: 14px;"><strong>البنك:</strong> ${bankName}</p>
             ${maskedIban ? `<p style="margin: 4px 0; color: #1e293b; font-size: 14px; font-family: monospace;"><strong>الآيبان (IBAN):</strong> ${maskedIban}</p>` : ''}
             <p style="margin: 6px 0 0; color: #166534; font-size: 13px;">الحالة: قيد المطابقة والاعتماد المالي النهائي من الإدارة.</p>
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يرجى التكرم بالانتقال لتحديد نموذج الأرباح والنسبة المالية لمقرراتك:</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/teacher/payout-setup" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 38px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">الانتقال لاختيار نموذج الأرباح</a>
           </div>`
        ),
      };

    case "teacher_payout_submitted":
      return {
        subject: `تم استلام مقترح نموذج الأرباح بنجاح | Payout Model Submitted - Josoorcom`,
        html: wrapper(
          `💼 تم استلام مقترح نموذج الأرباح والنسبة المالية`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">تم بنجاح تسجيل مقترح النموذج المالي الخاص بك وتم تحويله مباشرة لإدارة منصة جسوركم للمراجعة والاعتماد:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
             ${fixedAmount ? `<p style="margin: 4px 0; color: #0f172a; font-size: 14px;"><strong>المبلغ المقطوع المقترح:</strong> ${fixedAmount.toLocaleString()} ر.س</p>` : ''}
             ${percentageRate ? `<p style="margin: 4px 0; color: #0f172a; font-size: 14px;"><strong>نسبة المبيعات المقترحة:</strong> ${percentageRate}%</p>` : ''}
             <p style="margin: 6px 0 0; color: #64748b; font-size: 13px;">تمت مزامنة الطلب لحظياً مع لوحة تحكم الإدارة المالية.</p>
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يمكنك متابعة حالة الاعتماد والتواصل مع الإدارة عبر لوحة تحكم المعلم:</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/instructor" style="background: #0f172a; color: #ffffff; padding: 14px 38px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">دخول لوحة تحكم المعلم</a>
           </div>`
        ),
      };

    case "teacher_offer_sent":
      return {
        subject: `عرض مالي جديد من إدارة جسوركم | Payout Offer from Josoorcom`,
        html: wrapper(
          `💼 عرض مالي مقترح من إدارة المنصة`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">حددت إدارة منصة جسوركم العرض المالي الخاص بك لمقرراتك الأكاديمية:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
             ${fixedAmount ? `<p style="margin: 4px 0; color: #0f172a; font-size: 14px;"><strong>المبلغ المقطوع المعتمد:</strong> ${fixedAmount.toLocaleString()} ر.س</p>` : ''}
             ${percentageRate ? `<p style="margin: 4px 0; color: #0f172a; font-size: 14px;"><strong>نسبة المبيعات المقترحة:</strong> ${percentageRate}%</p>` : ''}
             ${offerMsg ? `<p style="margin: 10px 0 0; color: #475569; font-size: 14px; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px dashed #cbd5e1;"><strong>رسالة الإدارة:</strong> ${offerMsg}</p>` : ''}
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يمكنك مراجعة تفاصيل العرض والموافقة عليه أو تقديم عرض مقابل (Counter-Offer) عبر غرفة المفاوضة المباشرة في لوحة تحكمك.</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/instructor" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">دخول غرفة المفاوضة والرد على العرض</a>
           </div>`
        ),
      };

    case "teacher_offer_agreed":
      return {
        subject: `تهانينا! تم اعتماد الاتفاق المالي النهائي | Payout Agreement Finalized`,
        html: wrapper(
          `🎉 تم اعتماد وتفعيل الاتفاق المالي بنجاح!`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يسرنا إبلاغك بأن الاتفاق المالي قد تم اعتماده وتفعيله رسمياً من قبل الإدارة، وتمت مزامنة دفتر الحسابات المحاسبي تلقائياً.</p>
           <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0;">
             ${fixedAmount ? `<p style="margin: 6px 0; color: #166534; font-size: 14px;"><strong>المبلغ المقطوع المعتمد:</strong> ${fixedAmount.toLocaleString()} ر.س</p>` : ''}
             ${percentageRate ? `<p style="margin: 6px 0; color: #166534; font-size: 14px;"><strong>نسبة العمولة المعتمدة:</strong> ${percentageRate}%</p>` : ''}
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">حسابك الآن نشط بالكامل، ويمكنك البدء في رفع الدروس واستقبال تسجيلات الطلاب فوراً.</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/instructor" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">دخول لوحة تحكم المعلم</a>
           </div>`
        ),
      };

    case "enrollment":
      return {
        subject: `تسجيل جديد في الكورس | New Enrollment - ${req.course_title_ar || req.course_title}`,
        html: wrapper(
          `🎉 تم تسجيلك في الكورس بنجاح!`,
          `<p style="color: #334155; line-height: 1.8;">مرحباً <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8;">تم تسجيلك بنجاح في كورس <strong>"${req.course_title_ar || req.course_title}"</strong>.</p>
           <div style="text-align: center; margin: 24px 0;">
             <a href="https://www.josoorcom.com/dashboard" style="background: ${brandGold}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">ابدأ التعلم الآن</a>
           </div>`
        ),
      };

    case "payment_confirmed":
      return {
        subject: `تأكيد الدفع | Payment Confirmed - ${req.amount} SAR`,
        html: wrapper(
          `✅ تم تأكيد دفعتك بنجاح`,
          `<p style="color: #334155; line-height: 1.8;">مرحباً <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8;">تم تأكيد دفعتك بمبلغ <strong>${req.amount?.toLocaleString()} ر.س</strong> بنجاح.</p>`
        ),
      };

    default:
      return {
        subject: "إشعار من منصة جسوركم",
        html: wrapper("إشعار جديد", `<p style="color: #334155;">مرحباً ${recipientName}، لديك إشعار جديد في منصة جسوركم.</p>`),
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ error: "Empty request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailReq: EmailRequest = JSON.parse(rawBody);
    const targetEmail = emailReq.to_email || emailReq.toEmail;

    if (!targetEmail || !emailReq.type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_email, type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const content = getEmailContent(emailReq);

    // If Resend API key is present, send email
    if (resendApiKey) {
      const emailResponse = await resend.emails.send({
        from: "josoorcom <noreply@josoorcom.com>",
        to: [targetEmail],
        subject: content.subject,
        html: content.html,
      });

      console.log("Notification email dispatched successfully:", emailResponse);

      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } else {
      console.warn("RESEND_API_KEY not configured, simulated email send to:", targetEmail);
      return new Response(
        JSON.stringify({ success: true, simulated: true, to: targetEmail }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to dispatch email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
