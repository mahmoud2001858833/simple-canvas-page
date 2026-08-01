CREATE OR REPLACE FUNCTION public.handle_monthly_installment_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan jsonb;
  v_months integer;
  v_total numeric;
  v_row public.monthly_installments;
  v_new_months_paid integer;
  v_period_end timestamptz;
  v_completed boolean;
BEGIN
  IF NEW.status <> 'paid'::payment_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid'::payment_status THEN
    RETURN NEW;
  END IF;

  v_plan := NEW.installment_plan;
  IF v_plan IS NULL OR COALESCE(v_plan->>'type','') <> 'monthly' OR NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_months := GREATEST(1, COALESCE((v_plan->>'total_months')::int, 3));
  v_total := COALESCE((v_plan->>'total_amount')::numeric, NEW.amount * v_months);

  SELECT * INTO v_row FROM public.monthly_installments
  WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  v_new_months_paid := COALESCE(v_row.months_paid, 0) + 1;
  IF v_new_months_paid > v_months THEN
    v_new_months_paid := v_months;
  END IF;
  v_completed := v_new_months_paid >= v_months;
  v_period_end := now() + interval '1 month';

  INSERT INTO public.monthly_installments (
    user_id, course_id, total_months, months_paid, monthly_amount, total_amount,
    current_period_start, current_period_end, status, last_payment_id
  ) VALUES (
    NEW.user_id, NEW.course_id, v_months, v_new_months_paid, NEW.amount, v_total,
    now(), CASE WHEN v_completed THEN NULL ELSE v_period_end END,
    CASE WHEN v_completed THEN 'completed' ELSE 'active' END, NEW.id
  )
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    total_months = v_months,
    months_paid = v_new_months_paid,
    monthly_amount = NEW.amount,
    total_amount = v_total,
    current_period_start = now(),
    current_period_end = CASE WHEN v_completed THEN NULL ELSE v_period_end END,
    status = CASE WHEN v_completed THEN 'completed' ELSE 'active' END,
    last_payment_id = NEW.id,
    updated_at = now();

  INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage, expires_at)
  VALUES (NEW.user_id, NEW.course_id, 'active', 100,
          CASE WHEN v_completed THEN NULL ELSE v_period_end END)
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    status = 'active',
    paid_percentage = 100,
    expires_at = CASE WHEN v_completed THEN NULL ELSE v_period_end END;

  INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
  VALUES (
    NEW.user_id,
    'Monthly installment activated',
    'تم تفعيل القسط الشهري',
    'Month ' || v_new_months_paid || ' of ' || v_months || ' paid. Access is active' ||
      CASE WHEN v_completed THEN ' permanently.' ELSE ' until ' || to_char(v_period_end, 'YYYY-MM-DD') || '.' END,
    'تم دفع الشهر ' || v_new_months_paid || ' من ' || v_months || '. الوصول مفعّل' ||
      CASE WHEN v_completed THEN ' بشكل دائم.' ELSE ' حتى ' || to_char(v_period_end, 'YYYY-MM-DD') || '.' END,
    'success',
    '/courses/' || NEW.course_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_installment_payment_ins ON public.payments;
CREATE TRIGGER trg_monthly_installment_payment_ins
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_monthly_installment_payment();

DROP TRIGGER IF EXISTS trg_monthly_installment_payment_upd ON public.payments;
CREATE TRIGGER trg_monthly_installment_payment_upd
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_monthly_installment_payment();