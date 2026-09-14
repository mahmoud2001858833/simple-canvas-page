import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nrioqyolqusiexgpxfxz.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaW9xeW9scXVzaWV4Z3B4Znh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTUyOTAsImV4cCI6MjA4NDIzMTI5MH0.Uz6aoBl2kjTKENXw8eTrSdOM4W93RVuWTDWr1fCLpAo';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Server-side deduplication store
const recentDispatches: Record<string, number> = {};

function generatePrestigiousEmail(req: any) {
  const brandGold = '#D4AF37';
  const brandDark = '#0f172a';
  const recipientName = req.to_name || req.toName || 'أستاذنا الفاضل';
  const contractUrl = req.contract_url || req.contractUrl;
  const fileUrl = req.file_url || req.fileUrl || 'https://www.josoorcom.com/وثيقة_الاعتماد_الفني_للفيلم_الرسمي_جسوركم.pdf';
  const fileName = req.file_name || req.fileName || 'دليل المعلم والمعايير الأكاديمية - منصة جسوركم.pdf';
  const fixedAmount = req.fixed_amount ?? req.fixedAmount;
  const percentageRate = req.percentage_rate ?? req.percentageRate;
  const offerMsg = req.offer_details || req.offerDetails;
  const bankName = req.bank_name || req.bankName || 'الحساب المصرفي المعتمد';
  const rawIban = req.iban || '';
  const maskedIban = rawIban.length > 8 ? `${rawIban.substring(0, 4)} **** **** ${rawIban.substring(rawIban.length - 4)}` : rawIban;

  const wrapper = (title: string, body: string, attachmentCard?: boolean) => `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc; padding: 24px;">
      <div style="background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); padding: 34px 24px; text-align: center; border-bottom: 3px solid #947a0a;">
          <div style="display: inline-block; width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 12px; line-height: 44px; font-size: 22px; color: #ffffff; font-weight: 900; margin-bottom: 8px;">ج</div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">منصة جسوركم الأكاديمية</h1>
          <p style="color: #fef3c7; margin: 6px 0 0; font-size: 13px; font-weight: 600;">بوابة التعليم الجامعي النوعي والتميز التخصصي</p>
        </div>

        <!-- Body Content -->
        <div style="padding: 36px 30px; background: #ffffff;">
          <h2 style="color: ${brandDark}; margin: 0 0 18px; font-size: 20px; font-weight: 800; line-height: 1.4;">${title}</h2>
          ${body}

          ${attachmentCard ? `
          <div style="margin-top: 26px; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">📎 الوثائق والمستندات الأكاديمية المرفقة:</p>
            <p style="margin: 4px 0 12px; font-size: 13px; color: #64748b;">${fileName}</p>
            <a href="${fileUrl}" style="background: #0f172a; color: #ffffff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block;">تحميل وثيقة المعايير (PDF)</a>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="padding: 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6;">
          <p style="margin: 0 0 4px; font-weight: 600; color: #475569;">هذا إشعار إداري رسمي صادر آلياً وموثق من نظام جسوركم الأكاديمي.</p>
          <p style="margin: 0; color: #94a3b8;">&copy; ${new Date().getFullYear()} منصة جسوركم (Josoorcom) - المملكة العربية السعودية. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </div>
  `;

  switch (req.type) {
    case 'teacher_offer_sent':
      return {
        subject: `عرض مالي ومفاوضة من إدارة منصة جسوركم | Payout Offer - Josoorcom`,
        html: wrapper(
          `💼 عرض مالي مقترح من إدارة المنصة`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">حددت إدارة منصة جسوركم عرض احتساب وتوزيع مستحقاتك المالية لمقرراتك الأكاديمية:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 22px 0;">
             ${percentageRate ? `<p style="margin: 6px 0; color: #0f172a; font-size: 15px;"><strong>نسبة المبيعات المقترحة:</strong> <span style="color: #d97706; font-weight: 800; font-size: 18px;">${percentageRate}%</span></p>` : ''}
             ${fixedAmount ? `<p style="margin: 6px 0; color: #0f172a; font-size: 15px;"><strong>المبلغ المقطوع المعتمد:</strong> <span style="font-weight: 800;">${fixedAmount.toLocaleString()} ر.س</span></p>` : ''}
             ${offerMsg ? `<div style="margin-top: 14px; padding: 12px 14px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;"><strong style="color: #475569; display: block; font-size: 12px; margin-bottom: 4px;">ملاحظات ورسالة الإدارة:</strong><p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${offerMsg}</p></div>` : ''}
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يمكنك مراجعة العرض والموافقة المباشرة عليه أو تقديم عرض مقابل في غرفة المفاوضة الخاصة بك:</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/instructor/negotiation" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 42px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(212,175,55,0.4);">دخول غرفة المفاوضة والرد على العرض</a>
           </div>`
        ),
      };

    case 'teacher_offer_agreed':
      return {
        subject: `تهانينا! تم اعتماد الاتفاق المالي النهائي رسمياً | Josoorcom Agreement Finalized`,
        html: wrapper(
          `🎉 تم اعتماد وتفعيل الاتفاق المالي بنجاح!`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يسرنا إبلاغك بأن الاتفاق المالي قد تم اعتماده وتفعيله رسمياً، وتمت مزامنة دفتر الحسابات المحاسبي تلقائياً.</p>
           <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 22px 0;">
             ${percentageRate ? `<p style="margin: 6px 0; color: #166534; font-size: 15px;"><strong>نسبة العمولة المعتمدة:</strong> <span style="font-weight: 900; font-size: 18px;">${percentageRate}%</span></p>` : ''}
             ${fixedAmount ? `<p style="margin: 6px 0; color: #166534; font-size: 15px;"><strong>المبلغ المقطوع المعتمد:</strong> <span style="font-weight: 900;">${fixedAmount.toLocaleString()} ر.س</span></p>` : ''}
             <p style="margin: 10px 0 0; color: #15803d; font-size: 13px;">الحالة: معتمد ونافذ رسمياً لمقرراتك الحالية والمستقبلية.</p>
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">حسابك الآن نشط بالكامل، ويمكنك البدء في رفع المقررات والدروس عبر لوحة تحكم المعلم:</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/instructor" style="background: #0f172a; color: #ffffff; padding: 14px 42px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">دخول لوحة تحكم المعلم</a>
           </div>`
        ),
      };

    case 'teacher_policy_confirmed':
      return {
        subject: `تم توثيق واعتماد اتفاقية التدريس رسمياً | Policy Confirmed - Josoorcom`,
        html: wrapper(
          `📜 تم توثيق واعتماد اتفاقية التدريس والشروط الأكاديمية`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">تم توثيق توقيعكم الرقمي على السياسات والمعايير الأكاديمية بنجاح وأصبحتم معلماً معتمداً في منصة جسوركم.</p>
           <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
             <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 700;">✅ تم إيداع النسخة الموقعة إلكترونياً والمصادقة عليها من قبل المنصة.</p>
             ${contractUrl ? `<p style="margin: 10px 0 0;"><a href="${contractUrl}" style="color: #15803d; text-decoration: underline; font-weight: 700; font-size: 14px;">تحميل العقد الرقمي الموثق (PDF)</a></p>` : ''}
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">الخطوة التالية المتبقية هي تحديد وتأكيد <strong>نموذج توزيع الأرباح المالي</strong> الخاص بمقرراتك.</p>
           <div style="text-align: center; margin: 32px 0;">
             <a href="https://www.josoorcom.com/teacher/payout-setup" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 42px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(212,175,55,0.4);">تحديد نموذج الأرباح المالي (الخطوة 2)</a>
           </div>`,
          false
        ),
      };

    case 'teacher_bank_submitted':
      return {
        subject: `تم استلام وتوثيق بياناتك البنكية بنجاح | Josoorcom Bank Details`,
        html: wrapper(
          `🏦 تم استلام وتوثيق بيانات حسابك البنكي بنجاح`,
          `<p style="color: #334155; line-height: 1.8; font-size: 15px;">الأستاذ الفاضل <strong>${recipientName}</strong>،</p>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">تم استلام وتشفير بيانات حسابك البنكي بنجاح في الإدارة المالية لمنصة جسوركم لإجراء التحويلات الشهرية للأرباح:</p>
           <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
             <p style="margin: 4px 0; color: #1e293b; font-size: 14px;"><strong>البنك:</strong> ${bankName}</p>
             ${maskedIban ? `<p style="margin: 4px 0; color: #1e293b; font-size: 14px; font-family: monospace;"><strong>الآيبان (IBAN):</strong> ${maskedIban}</p>` : ''}
             <p style="margin: 6px 0 0; color: #166534; font-size: 13px;">الحالة: مشفر وموثق للمطابقة المالية.</p>
           </div>
           <p style="color: #334155; line-height: 1.8; font-size: 15px;">يرجى التكرم بالانتقال لتحديد نموذج الأرباح والنسبة المالية لمقرراتك:</p>
           <div style="text-align: center; margin: 30px 0;">
             <a href="https://www.josoorcom.com/teacher/payout-setup" style="background: linear-gradient(135deg, ${brandGold} 0%, #b8960c 100%); color: #ffffff; padding: 14px 38px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">الانتقال لاختيار نموذج الأرباح</a>
           </div>`
        ),
      };

    default:
      return {
        subject: req.subject || 'إشعار رسمي من منصة جسوركم التعليمية',
        html: wrapper('إشعار إداري جديد', `<p style="color: #334155; line-height: 1.8;">مرحباً <strong>${recipientName}</strong>، لديك إشعار رسمي جديد في منصة جسوركم.</p>`),
      };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const targetEmail = (body.to_email || body.toEmail || '').toLowerCase().trim();
    const emailType = body.type;

    if (!targetEmail || !emailType) {
      return res.status(400).json({ error: 'Missing required fields: to_email, type' });
    }

    // Deduplication check: prevent multiple sends to same email within 40 seconds
    const dedupKey = `${targetEmail}_${emailType}`;
    const now = Date.now();
    if (recentDispatches[dedupKey] && now - recentDispatches[dedupKey] < 40000) {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        message: 'Duplicate send prevented within 40s window',
      });
    }
    recentDispatches[dedupKey] = now;

    const emailContent = generatePrestigiousEmail(body);

    // 1. Try forwarding to Supabase Edge Function
    try {
      const edgeRes = await supabase.functions.invoke('send-notification-email', {
        body: {
          ...body,
          to_email: targetEmail,
          toEmail: targetEmail,
          subject: emailContent.subject,
          html: emailContent.html,
        },
      });

      if (!edgeRes.error) {
        return res.status(200).json({ success: true, method: 'edge_function', data: edgeRes.data });
      }
    } catch (edgeErr) {
      console.warn('[Vercel API] Edge function invoke notice:', edgeErr);
    }

    // 2. Direct Resend fallback if RESEND_API_KEY is present
    if (RESEND_API_KEY) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'josoorcom <noreply@josoorcom.com>',
          to: [targetEmail],
          subject: emailContent.subject,
          html: emailContent.html,
        }),
      });

      const resendData = await resendRes.json();
      return res.status(200).json({ success: true, method: 'direct_resend', data: resendData });
    }

    return res.status(200).json({ success: true, simulated: true, to: targetEmail });
  } catch (error: any) {
    console.error('[Vercel API] send-lifecycle-email error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

