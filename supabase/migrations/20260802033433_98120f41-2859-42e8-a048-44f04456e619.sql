-- 1) Realtime for support chat + notifications + messages
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_chats REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.course_messages REPLICA IDENTITY FULL;
ALTER TABLE public.request_messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;

-- 2) Instructors can view enrollments of their own courses
DROP POLICY IF EXISTS "Instructors can view enrollments of own courses" ON public.enrollments;
CREATE POLICY "Instructors can view enrollments of own courses"
ON public.enrollments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
      AND c.instructor_id = auth.uid()
  )
);

-- 3) Student withdrawal => refund cascade
CREATE OR REPLACE FUNCTION public.handle_enrollment_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    -- Refund related paid payments (existing refund trigger reverses earnings, coupons, referrals)
    UPDATE public.payments
    SET status = 'refunded'
    WHERE user_id = NEW.user_id
      AND course_id = NEW.course_id
      AND status = 'paid'::payment_status;

    -- Stop any monthly installment plan
    UPDATE public.monthly_installments
    SET status = 'cancelled', updated_at = now()
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

    NEW.paid_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_enrollment_cancellation ON public.enrollments;
CREATE TRIGGER trg_handle_enrollment_cancellation
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.handle_enrollment_cancellation();

-- Make sure the payment refund trigger exists
DROP TRIGGER IF EXISTS trg_handle_payment_refund ON public.payments;
CREATE TRIGGER trg_handle_payment_refund
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_refund();

-- 4) Allow public read of the new profile-fields setting
DROP POLICY IF EXISTS "Public can read non-sensitive settings" ON public.platform_settings;
CREATE POLICY "Public can read non-sensitive settings"
ON public.platform_settings
FOR SELECT
USING (
  key = ANY (ARRAY[
    'instructor_intro_video_url','instructor_policies','instructor_policies_ar',
    'site_name','site_name_ar','support_email','allow_registration','maintenance_mode',
    'allow_payment','video_recording_protection','instructor_skip_onboarding',
    'instructor_hide_intro_video','announcement_bar_enabled','announcement_bar_text',
    'announcement_bar_text_en','profile_fields_required'
  ])
  OR has_role(auth.uid(), 'admin'::user_role)
);