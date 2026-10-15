-- ====================================================================
-- Harden online payment confirmation (AlinmaPay)
--
-- Problem: leaving the bank page and landing back on /payment/success was enough
-- to mark a payment as paid, because
--   * confirm_payment_on_return() set status = 'paid' without asking the bank,
--   * process_alinma_webhook() treated a missing result as SUCCESS / 000,
--   * both were executable by anon, and
--   * the payments RLS policy let a student update any column of their own payment.
--
-- After this migration only the gateway-verified server path (service role) or an
-- admin can move a real-money payment to 'paid'.
-- ====================================================================


-- 1) confirm_payment_on_return: post-payment fulfilment ONLY.
--    It never changes the payment status; it refuses to run until the payment
--    has been marked paid by the verified server path, and it runs once per payment.
CREATE OR REPLACE FUNCTION public.confirm_payment_on_return(
  p_payment_id uuid,
  p_order_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_pct numeric := 100;
  v_existing_id uuid;
  v_is_bundle boolean := false;
  v_course record;
BEGIN
  -- Locate the payment record
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Payment record not found');
  END IF;

  -- Security check: caller must be the payment owner or an admin
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_payment.user_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin') THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
  END IF;

  -- If order_id is provided, verify it matches
  IF p_order_id IS NOT NULL AND p_order_id <> '' AND v_payment.transaction_id IS NOT NULL THEN
    IF v_payment.transaction_id <> p_order_id THEN
      RETURN json_build_object('success', false, 'error', 'Order ID mismatch');
    END IF;
  END IF;

  -- The gateway decides, not the browser: never mark a payment as paid here.
  IF v_payment.status <> 'paid'::payment_status THEN
    RETURN json_build_object(
      'success', false,
      'status', v_payment.status::text,
      'error', 'Payment has not been confirmed by the gateway'
    );
  END IF;

  -- Fulfil only once per payment (prevents duplicate notifications / purchases)
  IF EXISTS (
    SELECT 1 FROM public.security_audit_logs
    WHERE record_id = v_payment.id AND action_type = 'payment_confirmed_return_receipt'
  ) THEN
    RETURN json_build_object('success', true, 'payment_id', p_payment_id, 'status', 'paid', 'already_processed', true);
  END IF;

  -- Determine target percentage from installment plan if exists
  IF v_payment.installment_plan IS NOT NULL THEN
    v_pct := COALESCE((v_payment.installment_plan->>'new_paid_percentage')::numeric, 100);
    IF (v_payment.installment_plan->>'is_bundle')::boolean = true THEN
      v_is_bundle := true;
    END IF;
  END IF;

  -- Check if course_id is a bundle
  IF v_payment.course_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.courses WHERE id = v_payment.course_id AND category = 'bundle')
       OR EXISTS (SELECT 1 FROM public.course_bundles WHERE id = v_payment.course_id) THEN
      v_is_bundle := true;
    END IF;
  END IF;

  -- If this is a bundle payment: ACTIVATE ALL PLATFORM COURSES!
  IF v_is_bundle AND v_payment.user_id IS NOT NULL THEN
    -- A. Activate all active platform courses
    FOR v_course IN
      SELECT id FROM public.courses WHERE is_active = true AND category <> 'bundle'
    LOOP
      SELECT id INTO v_existing_id
      FROM public.enrollments
      WHERE user_id = v_payment.user_id AND course_id = v_course.id;

      IF v_existing_id IS NULL THEN
        INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage, enrolled_at)
        VALUES (v_payment.user_id, v_course.id, 'active', 100, now());
      ELSE
        UPDATE public.enrollments
        SET status = 'active',
            paid_percentage = 100
        WHERE id = v_existing_id;
      END IF;
    END LOOP;

    -- B. Also activate the bundle course itself in enrollments
    IF v_payment.course_id IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM public.enrollments
      WHERE user_id = v_payment.user_id AND course_id = v_payment.course_id;

      IF v_existing_id IS NULL THEN
        INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage, enrolled_at)
        VALUES (v_payment.user_id, v_payment.course_id, 'active', 100, now());
      ELSE
        UPDATE public.enrollments
        SET status = 'active',
            paid_percentage = 100
        WHERE id = v_existing_id;
      END IF;
    END IF;

    -- C. Record in bundle_purchases
    IF v_payment.course_id IS NOT NULL THEN
      INSERT INTO public.bundle_purchases (bundle_id, user_id, payment_id, amount_paid, status, purchased_at)
      VALUES (v_payment.course_id, v_payment.user_id, v_payment.id, v_payment.amount, 'active', now())
      ON CONFLICT DO NOTHING;
    END IF;

    -- D. Send bundle activation notification
    INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
    VALUES (
      v_payment.user_id,
      'Bundle Activated!',
      'تم تفعيل الباقة وفتح جميع دورات المنصة!',
      'Congratulations! Your bundle payment was confirmed. All platform courses are now active.',
      'مبارك! تم تأكيد دفعتك وتفعيل باقة المقررات الشاملة. تم فتح جميع دورات المنصة في حسابك بنجاح.',
      'success',
      '/dashboard/student?tab=courses'
    );
  ELSE
    -- Standard single course activation
    IF v_payment.course_id IS NOT NULL AND v_payment.user_id IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM public.enrollments
      WHERE user_id = v_payment.user_id AND course_id = v_payment.course_id;

      IF v_existing_id IS NULL THEN
        INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage, enrolled_at)
        VALUES (v_payment.user_id, v_payment.course_id, 'active', v_pct, now());
      ELSE
        UPDATE public.enrollments
        SET status = 'active',
            paid_percentage = GREATEST(COALESCE(paid_percentage, 0), v_pct)
        WHERE id = v_existing_id;
      END IF;

      -- Notification to student
      INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
      VALUES (
        v_payment.user_id,
        'Payment Confirmed',
        'تم تأكيد الدفع وتفعيل الدورة',
        'Your payment has been confirmed and the course is active.',
        'تم تأكيد دفعتك وتفعيل الدورة بنجاح. يمكنك بدء التعلم الآن.',
        'success',
        '/courses/' || v_payment.course_id::text
      );
    END IF;
  END IF;

  -- Log action
  INSERT INTO public.security_audit_logs (user_id, action_type, table_name, record_id, details)
  VALUES (
    v_payment.user_id,
    'payment_confirmed_return_receipt',
    'payments',
    v_payment.id,
    jsonb_build_object('order_id', p_order_id, 'status', 'paid', 'is_bundle', v_is_bundle)
  );

  RETURN json_build_object('success', true, 'payment_id', p_payment_id, 'status', 'paid', 'is_bundle', v_is_bundle);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment_on_return(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_on_return(uuid, text) TO authenticated, service_role;


-- 2) process_alinma_webhook: no default "SUCCESS / 000", and callable by the service role only.
--    (Defaults cannot be removed with CREATE OR REPLACE, so the function is recreated.)
DROP FUNCTION IF EXISTS public.process_alinma_webhook(text, text, text, text, jsonb);

CREATE FUNCTION public.process_alinma_webhook(
  p_track_id text,
  p_transaction_id text,
  p_result text,
  p_response_code text,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_is_success boolean := false;
  v_is_failure boolean := false;
  v_norm_res text;
  v_norm_code text;
  v_status payment_status;
  v_pct numeric := 100;
  v_existing_id uuid;
BEGIN
  v_norm_res := upper(COALESCE(p_result, ''));
  v_norm_code := trim(COALESCE(p_response_code, ''));

  IF v_norm_res IN ('SUCCESS', 'SUCCESSFUL', 'CAPTURED', 'PAID', 'APPROVED')
     OR v_norm_code IN ('0', '00', '000', '1', '001')
     OR v_norm_res LIKE '%SUCCESS%'
     OR v_norm_res LIKE '%CAPTURED%' THEN
    v_is_success := true;
    v_status := 'paid'::payment_status;
  ELSIF v_norm_res IN ('FAILURE', 'UNSUCCESSFUL', 'DECLINED', 'CANCELED', 'CANCELLED', 'TIMEOUT', 'REJECTED')
     OR v_norm_code IN ('201', '202', '205', '209', '218', '220', '223', '225', '259', '301', '304', '401', '402', '403', '501', '502', '503') THEN
    v_is_failure := true;
    v_status := 'failed'::payment_status;
  ELSE
    -- Non-terminal or empty notification (e.g. Created, Pending): never treated as success
    RETURN json_build_object('success', true, 'message', 'Non-terminal event acknowledged');
  END IF;

  -- Locate matching payment record
  SELECT * INTO v_payment
  FROM public.payments
  WHERE (p_track_id IS NOT NULL AND p_track_id <> '' AND transaction_id = p_track_id)
     OR (p_transaction_id IS NOT NULL AND p_transaction_id <> '' AND tabby_payment_id = p_transaction_id)
     OR (p_track_id IS NOT NULL AND p_track_id <> '' AND id::text = p_track_id)
     OR (p_transaction_id IS NOT NULL AND p_transaction_id <> '' AND id::text = p_transaction_id)
     OR (p_transaction_id IS NOT NULL AND p_transaction_id <> '' AND transaction_id = p_transaction_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.security_audit_logs (action_type, table_name, details)
    VALUES ('alinma_webhook_unmatched', 'payments', jsonb_build_object(
      'track_id', p_track_id,
      'transaction_id', p_transaction_id,
      'result', p_result,
      'response_code', p_response_code,
      'raw_payload', p_raw_payload
    ));

    RETURN json_build_object('success', false, 'message', 'Payment record not found for webhook');
  END IF;

  -- A payment that is already paid is never downgraded by a later notification
  IF v_payment.status = 'paid'::payment_status AND v_status <> 'paid'::payment_status THEN
    RETURN json_build_object('success', true, 'status', 'paid', 'payment_id', v_payment.id, 'message', 'Already paid');
  END IF;

  -- Update payment record
  UPDATE public.payments
  SET status = v_status,
      paid_at = CASE WHEN v_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
      tabby_payment_id = COALESCE(p_transaction_id, tabby_payment_id),
      notes = COALESCE(notes, '') || ' | Alinma Webhook: ' || v_norm_res || ' (' || v_norm_code || ')'
  WHERE id = v_payment.id;

  -- If paid, activate enrollment
  IF v_status = 'paid' AND v_payment.course_id IS NOT NULL AND v_payment.user_id IS NOT NULL THEN
    IF v_payment.installment_plan IS NOT NULL THEN
      v_pct := COALESCE((v_payment.installment_plan->>'new_paid_percentage')::numeric, 100);
    END IF;

    SELECT id INTO v_existing_id
    FROM public.enrollments
    WHERE user_id = v_payment.user_id AND course_id = v_payment.course_id;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage, enrolled_at)
      VALUES (v_payment.user_id, v_payment.course_id, 'active', v_pct, now());
    ELSE
      UPDATE public.enrollments
      SET status = 'active',
          paid_percentage = GREATEST(COALESCE(paid_percentage, 0), v_pct)
      WHERE id = v_existing_id;
    END IF;

    -- Notification
    INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
    VALUES (
      v_payment.user_id,
      'Payment Successful',
      'تم تأكيد الدفع وتفعيل الدورة',
      'Your payment has been received and your course is now activated.',
      'تم استلام دفعتك بنجاح وتم تفعيل اشتراكك بالدورة بنجاح.',
      'success',
      '/courses/' || v_payment.course_id::text
    );
  END IF;

  -- Audit log
  INSERT INTO public.security_audit_logs (user_id, action_type, table_name, record_id, details)
  VALUES (
    v_payment.user_id,
    'alinma_webhook_processed',
    'payments',
    v_payment.id,
    jsonb_build_object(
      'track_id', p_track_id,
      'transaction_id', p_transaction_id,
      'status', v_status,
      'result', p_result,
      'response_code', p_response_code
    )
  );

  RETURN json_build_object('success', true, 'status', v_status, 'payment_id', v_payment.id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_alinma_webhook(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_alinma_webhook(text, text, text, text, jsonb) TO service_role;


-- 3) Students must not be able to mark a real-money payment as paid (or edit its amount)
--    straight from the browser. Allowed for non-admin users:
--      * insert a payment that is not 'paid' (or is free: amount = 0)
--      * pending -> failed on their own attempt (abandon / cancel)
--      * status / paid_at changes on free payments (amount = 0, e.g. free-course enrollment)
--      * updating harmless columns such as receipt_url and notes
--    Always allowed: service role / SQL editor (no JWT user), admins, and changes made by
--    other database triggers (e.g. the enrollment-withdrawal -> refund cascade).
CREATE OR REPLACE FUNCTION public.guard_payment_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR pg_trigger_depth() > 1
     OR public.has_role(auth.uid(), 'admin'::user_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'paid'::payment_status AND COALESCE(NEW.amount, 0) > 0 THEN
      RAISE EXCEPTION 'A paid payment can only be created by the payment gateway or an admin'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.course_id IS DISTINCT FROM OLD.course_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.tabby_payment_id IS DISTINCT FROM OLD.tabby_payment_id
     OR NEW.installment_plan IS DISTINCT FROM OLD.installment_plan THEN
    RAISE EXCEPTION 'Payment details cannot be modified'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    IF NOT (
      (OLD.status = 'pending'::payment_status
        AND NEW.status = 'failed'::payment_status
        AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at)
      OR COALESCE(NEW.amount, 0) = 0
    ) THEN
      RAISE EXCEPTION 'Payment status can only be changed by the payment gateway or an admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payment_writes ON public.payments;
CREATE TRIGGER trg_guard_payment_writes
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_writes();
