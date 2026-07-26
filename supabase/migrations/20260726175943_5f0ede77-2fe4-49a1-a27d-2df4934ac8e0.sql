
-- Add structured fields to custom_course_requests
ALTER TABLE public.custom_course_requests
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS course_name text,
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS section text;

-- Support: admin internal messages (not visible to end user)
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS admin_internal boolean NOT NULL DEFAULT false;

-- Ensure new courses require admin approval by default
ALTER TABLE public.courses
  ALTER COLUMN is_approved SET DEFAULT false,
  ALTER COLUMN approval_status SET DEFAULT 'pending';
