-- ====================================================================
-- Secure Payment Activation Functions for AlinmaPay
-- Enables zero-second course activation both on return receipt and webhook
-- ====================================================================

-- 1. Function called when customer lands on return receipt (/payment/success)
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

  -- Update payment status to paid
  UPDATE public.payments
  SET status = 'paid'::payment_status,
      paid_at = COALESCE(paid_at, now()),
      notes = COALESCE(notes, '') || ' | Gateway Return Confirmed'
  WHERE id = p_payment_id;

  -- Determine target percentage from installment plan if exists
  IF v_payment.installment_plan IS NOT NULL THEN
    v_pct := COALESCE((v_payment.installment_plan->>'new_paid_percentage')::numeric, 100);
  END IF;

  -- Direct guaranteed enrollment activation
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

  -- Log action
  INSERT INTO public.security_audit_logs (user_id, action_type, table_name, record_id, details)
  VALUES (
    v_payment.user_id,
    'payment_confirmed_return_receipt',
    'payments',
    v_payment.id,
    jsonb_build_object('order_id', p_order_id, 'status', 'paid')
  );

  RETURN json_build_object('success', true, 'payment_id', p_payment_id, 'status', 'paid');
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_payment_on_return(uuid, text) TO authenticated, anon, service_role;


-- 2. Function called by Vercel Serverless Webhook / Alinma Webhook
CREATE OR REPLACE FUNCTION public.process_alinma_webhook(
  p_track_id text,
  p_transaction_id text DEFAULT NULL,
  p_result text DEFAULT 'SUCCESS',
  p_response_code text DEFAULT '000',
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
    -- Non-terminal notification (e.g. Created, Pending)
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

GRANT EXECUTE ON FUNCTION public.process_alinma_webhook(text, text, text, text, jsonb) TO authenticated, anon, service_role;
