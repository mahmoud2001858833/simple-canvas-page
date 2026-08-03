-- 0) Remove duplicate earnings rows (keep the newest per payment)
DELETE FROM public.instructor_earnings e
USING public.instructor_earnings d
WHERE e.payment_id IS NOT NULL
  AND e.payment_id = d.payment_id
  AND (e.created_at < d.created_at OR (e.created_at = d.created_at AND e.id < d.id));

-- 1) Prevent duplicate earnings per payment
CREATE UNIQUE INDEX IF NOT EXISTS instructor_earnings_payment_id_uniq
  ON public.instructor_earnings(payment_id) WHERE payment_id IS NOT NULL;

-- 2) Automatically finalize a paid payment: enrollment + instructor earnings
CREATE OR REPLACE FUNCTION public.finalize_paid_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pct numeric;
  v_instructor uuid;
  v_rate numeric;
  v_existing_id uuid;
BEGIN
  IF NEW.status <> 'paid'::payment_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid'::payment_status THEN
    RETURN NEW;
  END IF;
  IF NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_pct := COALESCE((NEW.installment_plan->>'new_paid_percentage')::numeric, 100);

  SELECT id INTO v_existing_id FROM public.enrollments
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage)
    VALUES (NEW.user_id, NEW.course_id, 'active', v_pct);
  ELSE
    UPDATE public.enrollments
    SET status = 'active',
        paid_percentage = GREATEST(COALESCE(paid_percentage, 0), v_pct)
    WHERE id = v_existing_id;
  END IF;

  SELECT instructor_id, COALESCE(instructor_commission, 30)
  INTO v_instructor, v_rate
  FROM public.courses WHERE id = NEW.course_id;

  IF v_instructor IS NOT NULL AND NEW.amount > 0 THEN
    INSERT INTO public.instructor_earnings (instructor_id, payment_id, course_id, amount, commission_rate, status)
    VALUES (v_instructor, NEW.id, NEW.course_id, ROUND(NEW.amount * v_rate / 100.0, 2), v_rate, 'pending')
    ON CONFLICT (payment_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalize_paid_payment ON public.payments;
CREATE TRIGGER trg_finalize_paid_payment
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.finalize_paid_payment();

-- 3) Allow a user to mark their own abandoned online payment as failed (never "pending")
CREATE OR REPLACE FUNCTION public.mark_payment_failed(p_payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.payments
  SET status = 'failed'::payment_status,
      notes = COALESCE(notes, '') || ' | Marked failed: payment not completed'
  WHERE id = p_payment_id
    AND status = 'pending'::payment_status
    AND payment_method = 'online'::payment_method
    AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 4) Change a course commission rate, optionally retroactively for existing earnings
CREATE OR REPLACE FUNCTION public.set_course_commission(p_course_id uuid, p_rate numeric, p_retroactive boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  IF p_rate < 0 OR p_rate > 100 THEN
    RAISE EXCEPTION 'Invalid commission rate';
  END IF;

  UPDATE public.courses SET instructor_commission = p_rate, updated_at = now()
  WHERE id = p_course_id;

  IF p_retroactive THEN
    UPDATE public.instructor_earnings e
    SET amount = ROUND(p.amount * p_rate / 100.0, 2),
        commission_rate = p_rate
    FROM public.payments p
    WHERE e.payment_id = p.id
      AND e.course_id = p_course_id
      AND e.status <> 'paid'
      AND e.status <> 'refunded';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN json_build_object('success', true, 'updated_earnings', v_updated);
END;
$$;

-- 5) Cloud backups of financial data
CREATE TABLE IF NOT EXISTS public.financial_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  payments_count integer NOT NULL DEFAULT 0,
  earnings_count integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.financial_backups TO authenticated;
GRANT ALL ON public.financial_backups TO service_role;

ALTER TABLE public.financial_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage financial backups" ON public.financial_backups;
CREATE POLICY "Admins manage financial backups"
ON public.financial_backups FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE OR REPLACE FUNCTION public.create_financial_backup(p_label text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_snapshot jsonb;
  v_payments integer;
  v_earnings integer;
  v_revenue numeric;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT count(*), COALESCE(sum(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)
  INTO v_payments, v_revenue FROM public.payments;
  SELECT count(*) INTO v_earnings FROM public.instructor_earnings;

  v_snapshot := jsonb_build_object(
    'created_at', now(),
    'payments', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.payments p), '[]'::jsonb),
    'instructor_earnings', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM public.instructor_earnings e), '[]'::jsonb),
    'coupon_usage', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.coupon_usage c), '[]'::jsonb),
    'withdrawal_requests', COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM public.withdrawal_requests w), '[]'::jsonb),
    'monthly_installments', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.monthly_installments m), '[]'::jsonb)
  );

  INSERT INTO public.financial_backups (label, payments_count, earnings_count, total_revenue, snapshot, created_by)
  VALUES (COALESCE(p_label, 'نسخة مالية ' || to_char(now(), 'YYYY-MM-DD HH24:MI')), v_payments, v_earnings, v_revenue, v_snapshot, auth.uid())
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'backup_id', v_id, 'payments', v_payments, 'earnings', v_earnings, 'revenue', v_revenue);
END;
$$;

-- 6) Reset all financial data (keeps users, courses and enrollments)
CREATE OR REPLACE FUNCTION public.reset_financial_data(p_backup_first boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_backup json := NULL;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  IF p_backup_first THEN
    v_backup := public.create_financial_backup('نسخة تلقائية قبل التصفير');
  END IF;

  DELETE FROM public.referral_earnings;
  UPDATE public.referrals SET payment_id = NULL, status = 'pending', commission_amount = 0, converted_at = NULL;
  DELETE FROM public.coupon_usage;
  UPDATE public.coupons SET current_uses = 0;
  DELETE FROM public.withdrawal_requests;
  DELETE FROM public.instructor_earnings;
  DELETE FROM public.monthly_installments;
  DELETE FROM public.payments;

  RETURN json_build_object('success', true, 'backup', v_backup);
END;
$$;