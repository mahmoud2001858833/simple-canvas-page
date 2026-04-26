CREATE OR REPLACE FUNCTION public.use_coupon(p_coupon_id uuid, p_user_id uuid, p_payment_id uuid, p_discount_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomic increment: only succeeds if under max_uses
  UPDATE public.coupons
  SET current_uses = COALESCE(current_uses, 0) + 1
  WHERE id = p_coupon_id
    AND is_active = true
    AND (max_uses IS NULL OR COALESCE(current_uses, 0) < max_uses);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Record usage
  INSERT INTO public.coupon_usage (coupon_id, user_id, payment_id, discount_amount)
  VALUES (p_coupon_id, p_user_id, p_payment_id, p_discount_amount);

  RETURN true;
END;
$$;