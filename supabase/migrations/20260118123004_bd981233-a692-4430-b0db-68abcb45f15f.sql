-- Add university and major fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities(id),
ADD COLUMN IF NOT EXISTS major_id uuid REFERENCES public.majors(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_university ON public.profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_profiles_major ON public.profiles(major_id);