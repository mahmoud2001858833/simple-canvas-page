-- ====================================================================
-- Free enrollment is decided by the server, never by the browser.
--
-- Before this migration a student could
--   * INSERT / UPDATE their own `enrollments` row straight from the browser
--     (status = 'active', paid_percentage = 100) for ANY course, and
--   * create a payment with amount = 0 and mark it paid for a paid course
--     (the paid-payment trigger then enrolled them).
--
-- After this migration:
--   * enroll_free_course() is the only way a student gets a free / 100%-coupon enrollment
--     (the server reads the real course price and validates the coupon),
--   * a trigger on `enrollments` stops non-admins from granting themselves, extending or
--     upgrading access to a course that is not free in the database,
--   * the payments guard only accepts amount = 0 for a course that really is free.
--
-- Always trusted (never blocked): service role / SQL editor (no JWT user), admins, changes
-- made by other triggers (pg_trigger_depth() > 1), and server functions that raise the
-- transaction-local flag `app.payment_trusted_write`.
-- ====================================================================


-- 1) Is this course really free in the database?
CREATE OR REPLACE FUNCTION public.is_free_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(c.price, 0) = 0 FROM public.courses c WHERE c.id = p_course_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_free_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_free_course(uuid) TO authenticated, service_role;


-- 2) Server-side free / 100%-coupon enrollment
CREATE OR REPLACE FUNCTION public.enroll_free_course(
  p_course_id uuid,
  p_coupon_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course record;
  v_price numeric;
  v_code text := NULLIF(btrim(COALESCE(p_coupon_code, '')), '');
  v_coupon json;
  v_alt text;
  v_coupon_id uuid;
  v_discount numeric := 0;
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT id, price, is_active INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND OR NOT COALESCE(v_course.is_active, false) THEN
    RETURN json_build_object('success', false, 'error', 'course_not_available');
  END IF;

  v_price := COALESCE(v_course.price, 0);

  -- Already fully enrolled: nothing to do
  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE user_id = v_uid AND course_id = p_course_id
      AND status = 'active' AND COALESCE(paid_percentage, 0) >= 100
  ) THEN
    RETURN json_build_object('success', true, 'already_enrolled', true);
  END IF;

  -- A paid course is only free when a valid coupon brings the FULL price to zero
  IF v_price > 0 THEN
    IF v_code IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'not_free');
    END IF;

    v_coupon := public.validate_coupon(v_code, v_uid, p_course_id, v_price);

    -- Same Arabic/English alias fallback the checkout page has always applied
    IF NOT COALESCE((v_coupon->>'valid')::boolean, false)
       AND (v_code = 'ريمان' OR upper(v_code) = 'REMAN') THEN
      v_alt := CASE WHEN v_code = 'ريمان' THEN 'REMAN' ELSE 'ريمان' END;
      v_coupon := public.validate_coupon(v_alt, v_uid, p_course_id, v_price);
    END IF;

    IF NOT COALESCE((v_coupon->>'valid')::boolean, false) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'invalid_coupon',
        'details', COALESCE(v_coupon->>'error_ar', v_coupon->>'error', '')
      );
    END IF;

    IF COALESCE((v_coupon->>'final_amount')::numeric, v_price) > 0 THEN
      RETURN json_build_object('success', false, 'error', 'not_free');
    END IF;

    v_coupon_id := (v_coupon->>'coupon_id')::uuid;
    v_discount := COALESCE((v_coupon->>'discount_amount')::numeric, 0);
  END IF;

  -- From here on this transaction is trusted to write the payment / enrollment itself
  PERFORM set_config('app.payment_trusted_write', 'on', true);

  IF v_coupon_id IS NOT NULL THEN
    INSERT INTO public.payments (user_id, course_id, amount, payment_method, status, paid_at, notes)
    VALUES (v_uid, p_course_id, 0, 'online', 'paid', now(), 'Free enrollment (100% coupon)')
    RETURNING id INTO v_payment_id;

    IF NOT COALESCE(public.use_coupon(v_coupon_id, v_uid, v_payment_id, v_discount), false) THEN
      -- Rolls back the payment above as well
      RAISE EXCEPTION 'coupon_no_longer_valid';
    END IF;
  END IF;

  INSERT INTO public.enrollments (user_id, course_id, status, paid_percentage, enrolled_at)
  VALUES (v_uid, p_course_id, 'active', 100, now())
  ON CONFLICT (user_id, course_id)
  DO UPDATE SET status = 'active',
                paid_percentage = GREATEST(COALESCE(public.enrollments.paid_percentage, 0), 100);

  PERFORM set_config('app.payment_trusted_write', 'off', true);

  RETURN json_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_free_course(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_free_course(uuid, text) TO authenticated, service_role;


-- 3) Payments guard: amount = 0 is only accepted for a course that is really free
CREATE OR REPLACE FUNCTION public.guard_payment_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR pg_trigger_depth() > 1
     OR COALESCE(current_setting('app.payment_trusted_write', true), '') = 'on'
     OR public.has_role(auth.uid(), 'admin'::user_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'paid'::payment_status AND COALESCE(NEW.amount, 0) > 0 THEN
      RAISE EXCEPTION 'A paid payment can only be created by the payment gateway or an admin'
        USING ERRCODE = '42501';
    END IF;
    IF COALESCE(NEW.amount, 0) = 0 AND NOT public.is_free_course(NEW.course_id) THEN
      RAISE EXCEPTION 'A free payment is only allowed for a course that is free'
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
      OR (COALESCE(NEW.amount, 0) = 0 AND public.is_free_course(NEW.course_id))
    ) THEN
      RAISE EXCEPTION 'Payment status can only be changed by the payment gateway or an admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- 4) Enrollments guard: a student cannot grant, extend or upgrade access to a paid course
--    Allowed for non-admin users: enrolling in a free course, bank-transfer rows that are
--    not active yet, progress / completion updates, and withdrawing (status -> cancelled).
CREATE OR REPLACE FUNCTION public.guard_enrollment_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR pg_trigger_depth() > 1
     OR COALESCE(current_setting('app.payment_trusted_write', true), '') = 'on'
     OR public.has_role(auth.uid(), 'admin'::user_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' AND NOT public.is_free_course(NEW.course_id) THEN
      RAISE EXCEPTION 'Access to a paid course is only granted after a confirmed payment'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    RAISE EXCEPTION 'Enrollment owner and course cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'active' AND NOT public.is_free_course(NEW.course_id) THEN
    IF OLD.status IS DISTINCT FROM 'active'
       OR COALESCE(NEW.paid_percentage, 0) > COALESCE(OLD.paid_percentage, 0)
       OR NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'Access to a paid course can only be changed after a confirmed payment'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_enrollment_writes ON public.enrollments;
CREATE TRIGGER trg_guard_enrollment_writes
BEFORE INSERT OR UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_enrollment_writes();


-- 5) confirm_payment_on_return writes enrollments from the student's own session (after the
--    payment has been marked paid by the gateway), so it must raise the trusted flag.
--    Same function as before plus the flag.
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

  -- Payment is confirmed paid by the gateway: this transaction may now write enrollments.
  PERFORM set_config('app.payment_trusted_write', 'on', true);

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

  PERFORM set_config('app.payment_trusted_write', 'off', true);

  RETURN json_build_object('success', true, 'payment_id', p_payment_id, 'status', 'paid', 'is_bundle', v_is_bundle);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment_on_return(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_on_return(uuid, text) TO authenticated, service_role;
