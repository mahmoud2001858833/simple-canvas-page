-- Add instructor_skip_onboarding and instructor_hide_intro_video to public readable settings
DROP POLICY IF EXISTS "Public can read non-sensitive settings" ON public.platform_settings;

CREATE POLICY "Public can read non-sensitive settings" 
ON public.platform_settings 
FOR SELECT 
USING (
  (key = ANY (ARRAY[
    'instructor_intro_video_url'::text, 
    'instructor_policies'::text, 
    'instructor_policies_ar'::text, 
    'site_name'::text, 
    'site_name_ar'::text, 
    'support_email'::text, 
    'allow_registration'::text, 
    'maintenance_mode'::text, 
    'allow_payment'::text, 
    'video_recording_protection'::text,
    'instructor_skip_onboarding'::text,
    'instructor_hide_intro_video'::text
  ])) 
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- Insert default value for instructor_skip_onboarding if not exists
INSERT INTO public.platform_settings (key, value)
VALUES ('instructor_skip_onboarding', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();