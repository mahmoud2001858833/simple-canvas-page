
-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value numeric NOT NULL,
  max_uses integer DEFAULT NULL, -- NULL = unlimited
  current_uses integer DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  max_discount_amount numeric DEFAULT NULL, -- cap for percentage discounts
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL DEFAULT NULL, -- NULL = all courses
  is_active boolean DEFAULT true,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid DEFAULT NULL,
  description text DEFAULT NULL,
  description_ar text DEFAULT NULL
);

-- Coupon usage tracking
CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  discount_amount numeric NOT NULL,
  used_at timestamptz DEFAULT now(),
  UNIQUE(coupon_id, user_id) -- each user can use a coupon only once
);

-- RLS for coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active coupons"
  ON public.coupons FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage coupons"
  ON public.coupons FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS for coupon_usage
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.coupon_usage FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own usage"
  ON public.coupon_usage FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage usage"
  ON public.coupon_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_active ON public.coupons(is_active, expires_at);
CREATE INDEX idx_coupon_usage_coupon_id ON public.coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user_id ON public.coupon_usage(user_id);

-- Function to validate and apply coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text,
  p_user_id uuid,
  p_course_id uuid DEFAULT NULL,
  p_order_amount numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coupon RECORD;
  v_discount numeric;
  v_already_used boolean;
BEGIN
  -- Find coupon
  SELECT * INTO v_coupon FROM public.coupons
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'invalid_code', 'error_ar', 'كود الكوبون غير صالح');
  END IF;

  -- Check expiry
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN json_build_object('valid', false, 'error', 'expired', 'error_ar', 'انتهت صلاحية الكوبون');
  END IF;

  -- Check max uses
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN json_build_object('valid', false, 'error', 'max_uses_reached', 'error_ar', 'تم استخدام الكوبون الحد الأقصى من المرات');
  END IF;

  -- Check if user already used
  SELECT EXISTS(
    SELECT 1 FROM public.coupon_usage WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN json_build_object('valid', false, 'error', 'already_used', 'error_ar', 'لقد استخدمت هذا الكوبون مسبقاً');
  END IF;

  -- Check course restriction
  IF v_coupon.course_id IS NOT NULL AND p_course_id IS NOT NULL AND v_coupon.course_id != p_course_id THEN
    RETURN json_build_object('valid', false, 'error', 'wrong_course', 'error_ar', 'هذا الكوبون لا ينطبق على هذا الكورس');
  END IF;

  -- Check min order amount
  IF p_order_amount < v_coupon.min_order_amount THEN
    RETURN json_build_object('valid', false, 'error', 'min_amount', 'error_ar', 'الحد الأدنى للطلب هو ' || v_coupon.min_order_amount || ' ر.س');
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := (p_order_amount * v_coupon.discount_value) / 100;
    IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_order_amount);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'final_amount', GREATEST(p_order_amount - v_discount, 0),
    'description', v_coupon.description,
    'description_ar', v_coupon.description_ar
  );
END;
$$;
