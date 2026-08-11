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

  DELETE FROM public.referral_earnings WHERE true;
  UPDATE public.referrals SET payment_id = NULL, status = 'pending', commission_amount = 0, converted_at = NULL WHERE true;
  UPDATE public.referral_codes SET total_earnings = 0, total_referrals = 0, updated_at = now() WHERE true;
  DELETE FROM public.coupon_usage WHERE true;
  UPDATE public.coupons SET current_uses = 0 WHERE true;
  DELETE FROM public.withdrawal_requests WHERE true;
  DELETE FROM public.instructor_earnings WHERE true;
  DELETE FROM public.monthly_installments WHERE true;
  DELETE FROM public.bundle_purchases WHERE true;
  DELETE FROM public.payments WHERE true;

  RETURN json_build_object('success', true, 'backup', v_backup);
END;
$function$;