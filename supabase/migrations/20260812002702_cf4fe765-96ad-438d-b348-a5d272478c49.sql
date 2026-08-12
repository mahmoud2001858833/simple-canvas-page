CREATE TABLE public.student_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  receipt_url text,
  notes text,
  processed_by uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_student_refunds_payment ON public.student_refunds(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_student_refunds_user ON public.student_refunds(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_refunds TO authenticated;
GRANT ALL ON public.student_refunds TO service_role;

ALTER TABLE public.student_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage student refunds"
ON public.student_refunds FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view own refunds"
ON public.student_refunds FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_student_refunds_updated_at
BEFORE UPDATE ON public.student_refunds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce 2-day withdrawal window
CREATE OR REPLACE FUNCTION public.handle_enrollment_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    IF NOT has_role(auth.uid(), 'admin'::user_role)
       AND COALESCE(OLD.enrolled_at, now()) < now() - interval '2 days' THEN
      RAISE EXCEPTION 'WITHDRAW_WINDOW_EXPIRED';
    END IF;

    UPDATE public.payments
    SET status = 'refunded'
    WHERE user_id = NEW.user_id
      AND course_id = NEW.course_id
      AND status = 'paid'::payment_status;

    UPDATE public.monthly_installments
    SET status = 'cancelled', updated_at = now()
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

    NEW.paid_percentage := 0;
  END IF;
  RETURN NEW;
END;
$function$;

-- Record student refund dues when a payment is refunded
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
  IF NEW.status = 'refunded'::payment_status AND (OLD.status IS DISTINCT FROM 'refunded'::payment_status) THEN
    UPDATE public.instructor_earnings
    SET status = 'refunded', paid_at = NULL
    WHERE payment_id = NEW.id;

    IF NEW.course_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
      UPDATE public.enrollments
      SET status = 'refunded', paid_percentage = 0
      WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
    END IF;

    FOR v_usage IN SELECT * FROM public.coupon_usage WHERE payment_id = NEW.id LOOP
      UPDATE public.coupons
      SET current_uses = GREATEST(0, COALESCE(current_uses, 1) - 1)
      WHERE id = v_usage.coupon_id;
      DELETE FROM public.coupon_usage WHERE id = v_usage.id;
    END LOOP;

    UPDATE public.referral_earnings
    SET status = 'refunded'
    WHERE referral_id IN (SELECT id FROM public.referrals WHERE payment_id = NEW.id);

    IF NEW.amount > 0 AND NEW.user_id IS NOT NULL THEN
      INSERT INTO public.student_refunds (user_id, course_id, payment_id, amount, status, reason)
      VALUES (NEW.user_id, NEW.course_id, NEW.id, NEW.amount, 'pending', 'انسحاب الطالب من الدورة')
      ON CONFLICT (payment_id) DO NOTHING;
    END IF;

    IF NEW.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
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
      SELECT instructor_id INTO v_instructor FROM public.courses WHERE id = NEW.course_id;
      IF v_instructor IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
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