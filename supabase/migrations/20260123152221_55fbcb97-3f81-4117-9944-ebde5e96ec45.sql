-- ==========================================
-- SECURITY FIX: SECURITY DEFINER Functions with proper authorization
-- ==========================================

-- 1. Fix handle_new_user() - CRITICAL: Remove ability to set own role via metadata
-- Always default to 'student', admins can promote users later
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    
    -- SECURITY FIX: Always assign 'student' role, ignore any role from metadata
    -- Users cannot assign themselves admin/instructor roles during signup
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id,
        'student'::user_role
    );
    
    RETURN NEW;
END;
$$;

-- 2. Fix get_admin_stats() - Add admin authorization check
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- SECURITY FIX: Only admins can access admin stats
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT json_build_object(
    'users', (SELECT count(*) FROM profiles),
    'courses', (SELECT count(*) FROM courses WHERE is_active = true),
    'revenue', COALESCE((SELECT sum(amount) FROM payments WHERE status = 'paid'), 0),
    'pending_requests', (SELECT count(*) FROM custom_course_requests WHERE status = 'pending'),
    'enrollments', (SELECT count(*) FROM enrollments),
    'total_payments', (SELECT count(*) FROM payments)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 3. Fix delete_course_cascade() - Add admin/owner authorization check
CREATE OR REPLACE FUNCTION public.delete_course_cascade(course_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  course_owner_id uuid;
BEGIN
  -- SECURITY FIX: Get course owner
  SELECT instructor_id INTO course_owner_id FROM public.courses WHERE id = course_uuid;
  
  -- Only allow deletion by admin or course owner
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR auth.uid() = course_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or course owners can delete courses';
  END IF;

  -- 1. Delete instructor earnings
  DELETE FROM public.instructor_earnings WHERE course_id = course_uuid;
  
  -- 2. Delete payments
  DELETE FROM public.payments WHERE course_id = course_uuid;
  
  -- 3. Delete certificates
  DELETE FROM public.certificates WHERE course_id = course_uuid;
  
  -- 4. Delete lesson progress for lessons in this course
  DELETE FROM public.lesson_progress 
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  -- 5. Delete video access logs for lessons in this course
  DELETE FROM public.video_access_logs 
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  -- 6. Delete lessons
  DELETE FROM public.lessons WHERE course_id = course_uuid;
  
  -- 7. Delete enrollments
  DELETE FROM public.enrollments WHERE course_id = course_uuid;
  
  -- 8. Finally delete the course
  DELETE FROM public.courses WHERE id = course_uuid;
  
  RETURN TRUE;
END;
$$;

-- ==========================================
-- SECURITY FIX: Platform Settings - Restrict public access to non-sensitive keys
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can read platform settings" ON public.platform_settings;

-- Create policy that only allows reading non-sensitive public settings
CREATE POLICY "Public can read non-sensitive settings"
ON public.platform_settings
FOR SELECT
USING (
  key IN (
    'instructor_intro_video_url',
    'instructor_policies',
    'instructor_policies_ar',
    'site_name',
    'site_name_ar',
    'support_email',
    'allow_registration',
    'maintenance_mode',
    'allow_payment',
    'video_recording_protection'
  )
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ==========================================
-- SECURITY FIX: Certificates - Add verification token for added protection
-- ==========================================

-- Add verification_token column for certificate validation
ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS verification_token text DEFAULT encode(gen_random_bytes(16), 'hex');

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_certificates_verification_token 
ON public.certificates(verification_token);

-- Update existing certificates with tokens if they don't have one
UPDATE public.certificates 
SET verification_token = encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL;