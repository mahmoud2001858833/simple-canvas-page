-- 1) Full financial reset: include bundle purchases + referral counters
CREATE OR REPLACE FUNCTION public.reset_financial_data(p_backup_first boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  UPDATE public.referral_codes SET total_earnings = 0, total_referrals = 0, updated_at = now();
  DELETE FROM public.coupon_usage;
  UPDATE public.coupons SET current_uses = 0;
  DELETE FROM public.withdrawal_requests;
  DELETE FROM public.instructor_earnings;
  DELETE FROM public.monthly_installments;
  DELETE FROM public.bundle_purchases;
  DELETE FROM public.payments;

  RETURN json_build_object('success', true, 'backup', v_backup);
END;
$function$;

-- 2) Online payments are never left pending: expire stale ones
CREATE OR REPLACE FUNCTION public.expire_stale_online_payments(p_minutes integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.payments
  SET status = 'failed'::payment_status,
      notes = COALESCE(notes, '') || ' | Auto-failed: no confirmation from gateway'
  WHERE status = 'pending'::payment_status
    AND payment_method = 'online'::payment_method
    AND created_at < now() - make_interval(mins => GREATEST(1, p_minutes));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.expire_stale_online_payments(integer) TO authenticated, service_role;