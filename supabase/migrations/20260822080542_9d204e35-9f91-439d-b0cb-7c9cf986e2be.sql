INSERT INTO public.platform_settings (key, value)
SELECT 'social_links', '[]'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'social_links');

DROP POLICY IF EXISTS "Public can read non-sensitive settings" ON public.platform_settings;

CREATE POLICY "Public can read non-sensitive settings" ON public.platform_settings
FOR SELECT USING (
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
    'instructor_hide_intro_video'::text,
    'announcement_bar_enabled'::text,
    'announcement_bar_text'::text,
    'announcement_bar_text_en'::text,
    'social_links'::text
  ])) OR has_role(auth.uid(), 'admin'::user_role)
);