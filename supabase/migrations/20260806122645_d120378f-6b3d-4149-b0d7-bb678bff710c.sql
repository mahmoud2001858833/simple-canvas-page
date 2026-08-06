UPDATE public.platform_settings SET value = 'true', updated_at = now() WHERE key = 'profile_fields_required';

INSERT INTO public.platform_settings (key, value)
SELECT 'profile_fields_required', 'true'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'profile_fields_required');

UPDATE public.profiles p
SET has_accepted_policies = false
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'instructor'
)
AND (
  p.specialty IS NULL OR p.specialty = ''
  OR p.academic_degree IS NULL OR p.academic_degree = ''
  OR p.institution_name IS NULL OR p.institution_name = ''
  OR p.phone IS NULL OR p.phone = ''
);