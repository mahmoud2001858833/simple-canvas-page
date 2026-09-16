-- ====================================================================
-- Bundles as Courses & Platform-Wide Course Activation
-- 1. Ensure bundles are mirrored as courses
-- 2. When a bundle payment is confirmed, activate ALL platform courses
-- ====================================================================

-- 1. Ensure course_bundles table exists with all required columns
CREATE TABLE IF NOT EXISTS public.course_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_ar text NOT NULL,
  description text,
  description_ar text,
  price numeric NOT NULL DEFAULT 0,
  original_price numeric,
  discount_percentage numeric DEFAULT 0,
  thumbnail_url text,
  is_active boolean DEFAULT true,
  valid_days integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure bundle_courses relation table exists
CREATE TABLE IF NOT EXISTS public.bundle_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bundle_courses_bundle_course_unique UNIQUE (bundle_id, course_id)
);

-- Ensure bundle_purchases tracking table exists
CREATE TABLE IF NOT EXISTS public.bundle_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'active',
  purchased_at timestamptz DEFAULT now()
);

-- RLS policies for bundle tables
ALTER TABLE public.course_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'course_bundles' AND policyname = 'Public can view active bundles') THEN
    CREATE POLICY "Public can view active bundles" ON public.course_bundles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'course_bundles' AND policyname = 'Admins can manage bundles') THEN
    CREATE POLICY "Admins can manage bundles" ON public.course_bundles FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bundle_courses' AND policyname = 'Public can view bundle courses') THEN
    CREATE POLICY "Public can view bundle courses" ON public.bundle_courses FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bundle_courses' AND policyname = 'Admins can manage bundle courses') THEN
    CREATE POLICY "Admins can manage bundle courses" ON public.bundle_courses FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bundle_purchases' AND policyname = 'Users can view own bundle purchases') THEN
    CREATE POLICY "Users can view own bundle purchases" ON public.bundle_purchases FOR SELECT USING (
      auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bundle_purchases' AND policyname = 'Authenticated users can insert bundle purchases') THEN
    CREATE POLICY "Authenticated users can insert bundle purchases" ON public.bundle_purchases FOR INSERT WITH CHECK (
      auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    );
  END IF;
END $$;


-- 2. Trigger function to automatically mirror any bundle into `courses` table as category 'bundle'
CREATE OR REPLACE FUNCTION public.sync_bundle_to_courses_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.courses WHERE id = OLD.id AND category = 'bundle';
    RETURN OLD;
  END IF;

  INSERT INTO public.courses (
    id,
    title,
    title_ar,
    description,
    description_ar,
    price,
    original_price,
    thumbnail_url,
    category,
    is_active,
    is_approved,
    approval_status,
    monthly_installment_enabled,
    monthly_installment_months
  ) VALUES (
    NEW.id,
    NEW.title,
    COALESCE(NEW.title_ar, NEW.title),
    COALESCE(NEW.description, 'باقة دورات شاملة'),
    COALESCE(NEW.description_ar, NEW.description, 'باقة دورات شاملة'),
    NEW.price,
    COALESCE(NEW.original_price, NEW.price),
    NEW.thumbnail_url,
    'bundle',
    COALESCE(NEW.is_active, true),
    true,
    'approved',
    true,
    3
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_ar = EXCLUDED.title_ar,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    thumbnail_url = EXCLUDED.thumbnail_url,
    category = 'bundle',
    is_active = EXCLUDED.is_active,
    is_approved = true,
    approval_status = 'approved',
    monthly_installment_enabled = true,
    monthly_installment_months = 3;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bundle_to_courses ON public.course_bundles;
CREATE TRIGGER trg_sync_bundle_to_courses
AFTER INSERT OR UPDATE OR DELETE ON public.course_bundles
FOR EACH ROW EXECUTE FUNCTION public.sync_bundle_to_courses_trigger();


-- 3. Security Definer RPC helper to ensure a bundle exists in courses table
CREATE OR REPLACE FUNCTION public.ensure_bundle_course(
  p_bundle_id uuid,
  p_title text,
  p_title_ar text DEFAULT NULL,
  p_price numeric DEFAULT 0,
  p_original_price numeric DEFAULT NULL,
  p_thumbnail_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.courses (
    id,
    title,
    title_ar,
    description,
    description_ar,
    price,
    original_price,
    thumbnail_url,
    category,
    is_active,
    is_approved,
    approval_status,
    monthly_installment_enabled,
    monthly_installment_months
  ) VALUES (
    p_bundle_id,
    p_title,
    COALESCE(p_title_ar, p_title),
    'باقة دورات شاملة: ' || COALESCE(p_title_ar, p_title),
    'باقة دورات شاملة: ' || COALESCE(p_title_ar, p_title),
    p_price,
    COALESCE(p_original_price, p_price),
    p_thumbnail_url,
    'bundle',
    true,
    true,
    'approved',
    true,
    3
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_ar = EXCLUDED.title_ar,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, courses.thumbnail_url),
    category = 'bundle',
    is_active = true,
    is_approved = true,
    approval_status = 'approved',
    monthly_installment_enabled = true,
    monthly_installment_months = 3;

  RETURN json_build_object('success', true, 'course_id', p_bundle_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_bundle_course(uuid, text, text, numeric, numeric, text) TO authenticated, anon, service_role;


-- 4. Update confirm_payment_on_return: When a bundle is confirmed, activate ALL platform courses!
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

  -- Update payment status to paid
  UPDATE public.payments
  SET status = 'paid'::payment_status,
      paid_at = COALESCE(paid_at, now()),
      notes = COALESCE(notes, '') || ' | Gateway Return Confirmed'
  WHERE id = p_payment_id;

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

GRANT EXECUTE ON FUNCTION public.confirm_payment_on_return(uuid, text) TO authenticated, anon, service_role;
