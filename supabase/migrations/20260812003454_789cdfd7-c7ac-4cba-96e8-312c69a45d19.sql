CREATE OR REPLACE FUNCTION public.handle_payment_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instructor uuid;
  v_usage RECORD;
BEGIN
  IF NEW.status = 'refunded'::payment_status
     AND (OLD.status IS DISTINCT FROM 'refunded'::payment_status) THEN
    UPDATE public.instructor_earnings
    SET status = 'refunded', paid_at = NULL
    WHERE payment_id = NEW.id;

    -- A direct payment refund must revoke access. When this trigger is nested
    -- inside handle_enrollment_cancellation, that enrollment row is already
    -- being updated; touching it again causes PostgreSQL to abort the command.
    IF pg_trigger_depth() = 1
       AND NEW.course_id IS NOT NULL
       AND NEW.user_id IS NOT NULL THEN
      UPDATE public.enrollments
      SET status = 'refunded', paid_percentage = 0
      WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
    END IF;

    FOR v_usage IN
      SELECT * FROM public.coupon_usage WHERE payment_id = NEW.id
    LOOP
      UPDATE public.coupons
      SET current_uses = GREATEST(0, COALESCE(current_uses, 1) - 1)
      WHERE id = v_usage.coupon_id;

      DELETE FROM public.coupon_usage WHERE id = v_usage.id;
    END LOOP;

    UPDATE public.referral_earnings
    SET status = 'refunded'
    WHERE referral_id IN (
      SELECT id FROM public.referrals WHERE payment_id = NEW.id
    );

    IF NEW.amount > 0 AND NEW.user_id IS NOT NULL THEN
      INSERT INTO public.student_refunds (
        user_id, course_id, payment_id, amount, status, reason
      )
      VALUES (
        NEW.user_id, NEW.course_id, NEW.id, NEW.amount,
        'pending', 'انسحاب الطالب من الدورة'
      )
      ON CONFLICT (payment_id) DO NOTHING;
    END IF;

    IF NEW.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, title, title_ar, message, message_ar, type, link
      )
      VALUES (
        NEW.user_id,
        'Payment Refunded',
        'تم تسجيل استرداد المبلغ',
        'Your payment of ' || NEW.amount || ' SAR was refunded and course access was revoked.',
        'تم تسجيل استرداد مبلغ ' || NEW.amount || ' ر.س وسيتم تحويله إليك، وتم إيقاف الوصول للدورة.',
        'info',
        '/dashboard'
      );
    END IF;

    IF NEW.course_id IS NOT NULL THEN
      SELECT instructor_id INTO v_instructor
      FROM public.courses
      WHERE id = NEW.course_id;

      IF v_instructor IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id, title, title_ar, message, message_ar, type, link
        )
        VALUES (
          v_instructor,
          'Payment Refunded',
          'تم استرداد دفعة',
          'A payment of ' || NEW.amount || ' SAR was refunded; related earnings were reversed.',
          'تم استرداد دفعة بقيمة ' || NEW.amount || ' ر.س وتم خصم الأرباح المرتبطة بها من مستحقاتك.',
          'warning',
          '/instructor-dashboard'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;