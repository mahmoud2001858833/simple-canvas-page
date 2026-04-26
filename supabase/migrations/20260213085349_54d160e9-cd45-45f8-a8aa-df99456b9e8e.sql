
-- 1. Create chapters table
CREATE TABLE public.chapters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Everyone can view chapters
CREATE POLICY "Everyone can view chapters"
ON public.chapters FOR SELECT
USING (true);

-- Instructors can manage chapters for their courses
CREATE POLICY "Instructors can manage own course chapters"
ON public.chapters FOR ALL
USING (
  has_role(auth.uid(), 'instructor'::user_role) AND
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.instructor_id = auth.uid())
);

-- Admins can manage all chapters
CREATE POLICY "Admins can manage chapters"
ON public.chapters FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- 2. Add chapter_id to lessons
ALTER TABLE public.lessons ADD COLUMN chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;

-- 3. Create lesson_attachments table
CREATE TABLE public.lesson_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;

-- Enrolled users + preview + instructors + admins can view attachments
CREATE POLICY "Users can view lesson attachments"
ON public.lesson_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_attachments.lesson_id
    AND (
      l.is_preview = true
      OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = l.course_id AND e.user_id = auth.uid() AND e.status = 'active')
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'instructor'::user_role)
    )
  )
);

-- Instructors can manage attachments for their course lessons
CREATE POLICY "Instructors can manage lesson attachments"
ON public.lesson_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_attachments.lesson_id
    AND (c.instructor_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role))
  )
);

-- 4. Add paid_percentage to enrollments
ALTER TABLE public.enrollments ADD COLUMN paid_percentage numeric NOT NULL DEFAULT 100;

-- 5. Create lesson-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-files', 'lesson-files', false);

-- Storage policies for lesson-files
CREATE POLICY "Authenticated users can upload lesson files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lesson-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view lesson files"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-files' AND auth.role() = 'authenticated');

CREATE POLICY "Instructors and admins can delete lesson files"
ON storage.objects FOR DELETE
USING (bucket_id = 'lesson-files' AND auth.role() = 'authenticated');

-- 6. Update delete_course_cascade to handle chapters
CREATE OR REPLACE FUNCTION public.delete_course_cascade(course_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  course_owner_id uuid;
BEGIN
  SELECT instructor_id INTO course_owner_id FROM public.courses WHERE id = course_uuid;
  
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR auth.uid() = course_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or course owners can delete courses';
  END IF;

  DELETE FROM public.instructor_earnings WHERE course_id = course_uuid;
  DELETE FROM public.payments WHERE course_id = course_uuid;
  DELETE FROM public.certificates WHERE course_id = course_uuid;
  
  -- Delete lesson attachments for lessons in this course
  DELETE FROM public.lesson_attachments
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  DELETE FROM public.lesson_progress 
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  DELETE FROM public.video_access_logs 
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  DELETE FROM public.lessons WHERE course_id = course_uuid;
  
  -- Delete chapters
  DELETE FROM public.chapters WHERE course_id = course_uuid;
  
  DELETE FROM public.enrollments WHERE course_id = course_uuid;
  DELETE FROM public.courses WHERE id = course_uuid;
  
  RETURN TRUE;
END;
$function$;
