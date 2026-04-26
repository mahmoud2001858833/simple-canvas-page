import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const brandColor = "#D4AF37";

const sendDeadlineEmail = async (email: string, name: string, requestTitle: string, type: 'warning' | 'overdue') => {
  try {
    const isOverdue = type === 'overdue';
    const subject = isOverdue
      ? `⚠️ طلبك تجاوز الموعد النهائي | Request Overdue - ${requestTitle}`
      : `⏰ اقتراب الموعد النهائي | Deadline Approaching - ${requestTitle}`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <div style="background: linear-gradient(135deg, ${brandColor}, #B8960C); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">josoorcom</h1>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px;">${isOverdue ? '⚠️ طلبك تجاوز الموعد النهائي' : '⏰ اقتراب موعد التسليم'}</h2>
            <p style="color: #4b5563; line-height: 1.8;">مرحباً <strong>${name}</strong>،</p>
            <p style="color: #4b5563; line-height: 1.8;">${isOverdue
              ? `طلبك <strong>"${requestTitle}"</strong> قد تجاوز الموعد النهائي المحدد.`
              : `طلبك <strong>"${requestTitle}"</strong> يقترب موعد تسليمه. يرجى المتابعة.`
            }</p>
            <div style="background: ${isOverdue ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${isOverdue ? '#fecaca' : '#fde68a'}; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: ${isOverdue ? '#991b1b' : '#92400e'}; margin: 0;">${isOverdue ? '❌ تم تجاوز الموعد النهائي' : '⏰ الموعد النهائي قريب جداً'}</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://xbuild.lovable.app/dashboard?tab=my-requests" style="background: ${brandColor}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">عرض طلباتي</a>
            </div>
          </div>
          <div style="padding: 16px 24px; background: #f3f4f6; text-align: center; font-size: 12px; color: #9ca3af;">
            &copy; ${new Date().getFullYear()} josoorcom. All rights reserved.
          </div>
        </div>
      </div>`;
    await resend.emails.send({
      from: "josoorcom <noreply@josoorcom.com>",
      to: [email],
      subject,
      html,
    });
    console.log(`Deadline email sent to ${email} (${type})`);
  } catch (e) {
    console.error(`Failed to send deadline email to ${email}:`, e);
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roleData } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', user.id).single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const now = Date.now();
    const rl = rateLimitMap.get(user.id);
    if (rl && now < rl.resetTime && rl.count >= RATE_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    rateLimitMap.set(user.id, { count: (rl && now < rl.resetTime ? rl.count : 0) + 1, resetTime: rl && now < rl.resetTime ? rl.resetTime : now + RATE_WINDOW });

    // Call DB function
    await supabaseAdmin.rpc('check_request_deadlines');

    const currentTime = new Date();
    const notificationsSent: string[] = [];

    // ========== 1. Check custom course request deadlines ==========
    const { data: requests } = await supabaseAdmin
      .from('custom_course_requests')
      .select('id, title, deadline, status, deadline_warning_sent, user_id')
      .not('status', 'eq', 'completed')
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true });

    const report = {
      checked_at: currentTime.toISOString(),
      checked_by: user.email,
      total_active_requests: requests?.length || 0,
      overdue: 0,
      due_soon: 0,
      on_track: 0,
      notifications_sent: 0,
      enrollment_warnings: 0,
      details: [] as any[],
    };

    if (requests) {
      for (const request of requests) {
        const deadline = new Date(request.deadline);
        const daysRemaining = Math.ceil((deadline.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));

        let urgency = 'on_track';
        if (daysRemaining < 0) {
          urgency = 'overdue';
          report.overdue++;
        } else if (daysRemaining <= 2) {
          urgency = 'due_soon';
          report.due_soon++;
        } else {
          report.on_track++;
        }

        report.details.push({
          id: request.id, title: request.title, deadline: request.deadline,
          status: request.status, days_remaining: daysRemaining, urgency,
        });

        // Send notification if deadline is within 3 days and warning not yet sent
        if (daysRemaining <= 3 && daysRemaining >= 0 && !request.deadline_warning_sent) {
          await supabaseAdmin.from('notifications').insert({
            user_id: request.user_id,
            title: 'Deadline Approaching',
            title_ar: 'اقتراب الموعد النهائي',
            message: `Your request "${request.title}" is due in ${daysRemaining} day(s).`,
            message_ar: `طلبك "${request.title}" يحل موعده خلال ${daysRemaining} يوم/أيام.`,
            type: daysRemaining <= 1 ? 'warning' : 'info',
            link: '/dashboard?tab=my-requests',
          });

          // Send email notification
          const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', request.user_id).single();
          if (profile?.email) {
            await sendDeadlineEmail(profile.email, profile.full_name || 'مستخدم', request.title, 'warning');
          }

          await supabaseAdmin.from('custom_course_requests')
            .update({ deadline_warning_sent: true })
            .eq('id', request.id);

          notificationsSent.push(`request:${request.id}`);
          report.notifications_sent++;
        }

        // Send overdue notification
        if (daysRemaining < 0 && daysRemaining >= -1) {
          await supabaseAdmin.from('notifications').insert({
            user_id: request.user_id,
            title: 'Deadline Passed',
            title_ar: 'انتهى الموعد النهائي',
            message: `Your request "${request.title}" deadline has passed.`,
            message_ar: `انتهى الموعد النهائي لطلبك "${request.title}".`,
            type: 'error',
            link: '/dashboard?tab=my-requests',
          });

          // Send overdue email to user
          const { data: overdueProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', request.user_id).single();
          if (overdueProfile?.email) {
            await sendDeadlineEmail(overdueProfile.email, overdueProfile.full_name || 'مستخدم', request.title, 'overdue');
          }

          // Also notify admins
          const { data: admins } = await supabaseAdmin
            .from('user_roles').select('user_id').eq('role', 'admin');
          if (admins) {
            for (const admin of admins) {
              await supabaseAdmin.from('notifications').insert({
                user_id: admin.user_id,
                title: 'Request Overdue',
                title_ar: 'طلب متأخر',
                message: `Request "${request.title}" is overdue.`,
                message_ar: `الطلب "${request.title}" تجاوز الموعد النهائي.`,
                type: 'error',
                link: '/admin?tab=requests',
              });
            }
          }
          report.notifications_sent++;
        }
      }
    }

    // ========== 2. Check enrollment expiry ==========
    const threeDaysLater = new Date(currentTime.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringEnrollments } = await supabaseAdmin
      .from('enrollments')
      .select('id, user_id, course_id, expires_at, status')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', threeDaysLater)
      .gte('expires_at', currentTime.toISOString());

    if (expiringEnrollments) {
      // Get course titles for these enrollments
      const courseIds = [...new Set(expiringEnrollments.map(e => e.course_id))];
      const { data: courses } = await supabaseAdmin
        .from('courses').select('id, title, title_ar').in('id', courseIds);
      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

      for (const enrollment of expiringEnrollments) {
        const course = courseMap.get(enrollment.course_id);
        const expiresAt = new Date(enrollment.expires_at!);
        const daysLeft = Math.ceil((expiresAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
        const courseName = course?.title || 'Course';
        const courseNameAr = course?.title_ar || 'الكورس';

        await supabaseAdmin.from('notifications').insert({
          user_id: enrollment.user_id,
          title: 'Enrollment Expiring Soon',
          title_ar: 'اشتراكك على وشك الانتهاء',
          message: `Your access to "${courseName}" expires in ${daysLeft} day(s). Complete your lessons now!`,
          message_ar: `صلاحية وصولك لكورس "${courseNameAr}" تنتهي خلال ${daysLeft} يوم/أيام. أكمل دروسك الآن!`,
          type: daysLeft <= 1 ? 'warning' : 'info',
          link: `/courses/${enrollment.course_id}`,
        });

        report.enrollment_warnings++;
        notificationsSent.push(`enrollment:${enrollment.id}`);
      }
    }

    // ========== 3. Check expired enrollments (just expired) ==========
    const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredEnrollments } = await supabaseAdmin
      .from('enrollments')
      .select('id, user_id, course_id, expires_at, status')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lt('expires_at', currentTime.toISOString())
      .gte('expires_at', oneDayAgo);

    if (expiredEnrollments) {
      const courseIds = [...new Set(expiredEnrollments.map(e => e.course_id))];
      const { data: courses } = await supabaseAdmin
        .from('courses').select('id, title, title_ar').in('id', courseIds.length ? courseIds : ['none']);
      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

      for (const enrollment of expiredEnrollments) {
        const course = courseMap.get(enrollment.course_id);
        await supabaseAdmin.from('notifications').insert({
          user_id: enrollment.user_id,
          title: 'Enrollment Expired',
          title_ar: 'انتهى اشتراكك',
          message: `Your access to "${course?.title || 'the course'}" has expired.`,
          message_ar: `انتهت صلاحية وصولك لكورس "${course?.title_ar || 'الكورس'}".`,
          type: 'error',
          link: `/courses/${enrollment.course_id}`,
        });

        // Update enrollment status
        await supabaseAdmin.from('enrollments')
          .update({ status: 'expired' })
          .eq('id', enrollment.id);

        report.enrollment_warnings++;
      }
    }

    // Audit log
    await supabaseAdmin.from('security_audit_logs').insert({
      user_id: user.id,
      action_type: 'check_deadlines',
      table_name: 'custom_course_requests',
      details: {
        total_checked: report.total_active_requests,
        overdue: report.overdue,
        due_soon: report.due_soon,
        notifications_sent: report.notifications_sent,
        enrollment_warnings: report.enrollment_warnings,
      }
    });

    return new Response(
      JSON.stringify({ success: true, report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in check-deadlines:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
