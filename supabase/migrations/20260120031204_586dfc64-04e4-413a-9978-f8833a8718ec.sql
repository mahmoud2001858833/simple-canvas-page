-- Create platform_settings table for instructor settings
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Everyone can read settings (for instructor onboarding)
CREATE POLICY "Everyone can read platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

-- Add default values
INSERT INTO public.platform_settings (key, value) VALUES 
  ('instructor_commission_rate', '30'),
  ('instructor_intro_video_url', ''),
  ('instructor_policies', ''),
  ('instructor_policies_ar', '');