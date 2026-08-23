-- 1. Lessons SELECT policy: scope instructor bypass to course owners
DROP POLICY IF EXISTS "View lesson with access control" ON public.lessons;
CREATE POLICY "View lesson with access control"
ON public.lessons FOR SELECT
USING (
  (is_preview = true)
  OR (auth.uid() IS NOT NULL AND public.user_has_course_access(auth.uid(), course_id))
  OR public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.instructor_id = auth.uid())
);

-- 2. quiz_options: hide answer key from students
DROP POLICY IF EXISTS "Enrolled, instructor, admin can view quiz options" ON public.quiz_options;
CREATE POLICY "Admins and owning instructors can view quiz options"
ON public.quiz_options FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    JOIN public.courses c ON c.id = q.course_id
    WHERE qq.id = quiz_options.question_id AND c.instructor_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_student(_quiz_id uuid)
RETURNS TABLE (
  question_id uuid,
  question text,
  question_ar text,
  question_sort_order integer,
  option_id uuid,
  option_text text,
  option_text_ar text,
  option_sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qq.id, qq.question, qq.question_ar, qq.sort_order,
         qo.id, qo.option_text, qo.option_text_ar, qo.sort_order
  FROM public.quiz_questions qq
  JOIN public.quizzes q ON q.id = qq.quiz_id
  JOIN public.courses c ON c.id = q.course_id
  LEFT JOIN public.quiz_options qo ON qo.question_id = qq.id
  WHERE qq.quiz_id = _quiz_id
    AND auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin'::user_role)
      OR c.instructor_id = auth.uid()
      OR public.user_has_course_access(auth.uid(), c.id)
    )
  ORDER BY qq.sort_order, qo.sort_order
$$;

REVOKE ALL ON FUNCTION public.get_quiz_questions_for_student(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_quiz_questions_for_student(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO service_role;

-- 3. lesson-files bucket: gate reads
DROP POLICY IF EXISTS "lesson-files public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view lesson files" ON storage.objects;
DROP POLICY IF EXISTS "lesson-files access controlled read" ON storage.objects;

CREATE POLICY "lesson-files access controlled read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lesson-files' AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR EXISTS (
      SELECT 1 FROM public.lesson_attachments la
      JOIN public.lessons l ON l.id = la.lesson_id
      JOIN public.courses c ON c.id = l.course_id
      WHERE la.file_url LIKE '%/lesson-files/' || objects.name
        AND (c.instructor_id = auth.uid() OR l.is_preview = true OR public.user_has_course_access(auth.uid(), l.course_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.chapter_files cf
      JOIN public.courses c ON c.id = cf.course_id
      WHERE cf.file_url LIKE '%/lesson-files/' || objects.name
        AND (c.instructor_id = auth.uid() OR public.user_has_course_access(auth.uid(), cf.course_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.quizzes qz
      JOIN public.courses c ON c.id = qz.course_id
      WHERE qz.file_url LIKE '%/lesson-files/' || objects.name
        AND (c.instructor_id = auth.uid() OR public.user_has_course_access(auth.uid(), qz.course_id))
    )
  )
);