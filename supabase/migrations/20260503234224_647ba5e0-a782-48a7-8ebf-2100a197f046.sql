
-- 1) Profiles: instructor academic info
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_degree text,
  ADD COLUMN IF NOT EXISTS academic_year text;

-- 2) video_notes: admin & course-owner instructor SELECT policies
DROP POLICY IF EXISTS "Admins can view all video notes" ON public.video_notes;
CREATE POLICY "Admins can view all video notes"
  ON public.video_notes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Instructors view notes on own course lessons" ON public.video_notes;
CREATE POLICY "Instructors view notes on own course lessons"
  ON public.video_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = video_notes.lesson_id
        AND c.instructor_id = auth.uid()
    )
  );
