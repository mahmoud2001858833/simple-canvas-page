-- Create a function to safely delete a course and all related data
CREATE OR REPLACE FUNCTION public.delete_course_cascade(course_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_course_cascade(UUID) TO authenticated;