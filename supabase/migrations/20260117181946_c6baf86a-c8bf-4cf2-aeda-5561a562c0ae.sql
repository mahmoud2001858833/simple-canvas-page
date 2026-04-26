-- Create indexes for performance optimization (high-load support)
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_major_id ON public.courses(major_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON public.courses(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_course_requests_status ON public.custom_course_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_course_requests_user_id ON public.custom_course_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);

-- Create a database function for efficient admin stats calculation
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
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

-- Create a function to get enrollment counts per course efficiently
CREATE OR REPLACE FUNCTION public.get_course_enrollment_counts()
RETURNS TABLE(course_id UUID, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT course_id, count(*) as count
  FROM enrollments
  GROUP BY course_id;
$$;