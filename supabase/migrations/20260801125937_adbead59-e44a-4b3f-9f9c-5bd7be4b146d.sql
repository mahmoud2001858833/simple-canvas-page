CREATE OR REPLACE FUNCTION public.handle_payment_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor uuid;
  v_usage RECORD;
BEGIN
  IF NEW.status = 'refunded'::payment_status AND (OLD.status IS DISTINCT FROM 'refunded'::payment_status) THEN
    -- 1) Reverse instructor earnings tied to this payment
    UPDATE public.instructor_earnings
    SET status = 'refunded', paid_at = NULL
    WHERE payment_id = NEW.id;

    -- 2) Revoke enrollment access
    IF NEW.course_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
      UPDATE public.enrollments
      SET status = 'refunded', paid_percentage = 0
      WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
    END IF;

    -- 3) Reverse coupon usage
    FOR v_usage IN SELECT * FROM public.coupon_usage WHERE payment_id = NEW.id LOOP
      UPDATE public.coupons
      SET current_uses = GREATEST(0, COALESCE(current_uses, 1) - 1)
      WHERE id = v_usage.coupon_id;
      DELETE FROM public.coupon_usage WHERE id = v_usage.id;
    END LOOP;

    -- 4) Reverse referral commission
    UPDATE public.referral_earnings
    SET status = 'refunded'
    WHERE referral_id IN (SELECT id FROM public.referrals WHERE payment_id = NEW.id);

    -- 5) Notify student
    IF NEW.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
      VALUES (
        NEW.user_id,
        'Payment Refunded',
        'تم استرداد المبلغ',
        'Your payment of ' || NEW.amount || ' SAR has been refunded and course access was revoked.',
        'تم استرداد مبلغ ' || NEW.amount || ' ر.س وتم إيقاف الوصول للدورة.',
        'info',
        '/dashboard'
      );
    END IF;

    -- 6) Notify instructor
    IF NEW.course_id IS NOT NULL THEN
      SELECT instructor_id INTO v_instructor FROM public.courses WHERE id = NEW.course_id;
      IF v_instructor IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
        VALUES (
          v_instructor,
          'Payment Refunded',
          'تم استرداد دفعة',
          'A payment of ' || NEW.amount || ' SAR was refunded; related earnings were reversed.',
          'تم استرداد دفعة بقيمة ' || NEW.amount || ' ر.س وتم عكس الأرباح المرتبطة بها.',
          'warning',
          '/instructor-dashboard'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_payment_refund ON public.payments;
CREATE TRIGGER trg_handle_payment_refund
AFTER UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_refund();