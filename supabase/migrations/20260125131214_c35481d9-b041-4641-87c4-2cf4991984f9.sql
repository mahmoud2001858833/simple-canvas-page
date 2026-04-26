-- Add performance indexes for high-traffic tables
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON public.lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_sort_order ON public.lessons(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON public.lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_completed ON public.lesson_progress(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_video_access_logs_user_lesson ON public.video_access_logs(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_access_logs_accessed_at ON public.video_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_screen_capture_attempts_user_id ON public.screen_capture_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_screen_capture_attempts_created_at ON public.screen_capture_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_status ON public.enrollments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- Create a public view for courses that hides instructor_commission
CREATE OR REPLACE VIEW public.courses_public 
WITH (security_invoker = on)
AS SELECT 
  id,
  title,
  title_ar,
  description,
  description_ar,
  price,
  original_price,
  thumbnail_url,
  duration_hours,
  category,
  major_id,
  instructor_id,
  is_active,
  is_approved,
  is_featured,
  approval_status,
  created_at,
  updated_at
FROM public.courses;

-- Grant SELECT on the public view to authenticated and anon users
GRANT SELECT ON public.courses_public TO authenticated;
GRANT SELECT ON public.courses_public TO anon;

-- Create a function to clean old logs (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete old video access logs
  DELETE FROM public.video_access_logs 
  WHERE accessed_at < NOW() - INTERVAL '90 days';
  
  -- Delete old screen capture attempts
  DELETE FROM public.screen_capture_attempts 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old security audit logs
  DELETE FROM public.security_audit_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;