
-- chapter_files
DROP POLICY IF EXISTS "Everyone can view chapter files" ON public.chapter_files;
CREATE POLICY "Enrolled, instructor, admin can view chapter files" ON public.chapter_files FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapter_files.course_id AND c.instructor_id = auth.uid())
  OR public.user_has_course_access(auth.uid(), chapter_files.course_id)
);

-- quizzes
DROP POLICY IF EXISTS "Everyone can view quizzes" ON public.quizzes;
CREATE POLICY "Enrolled, instructor, admin can view quizzes" ON public.quizzes FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = quizzes.course_id AND c.instructor_id = auth.uid())
  OR public.user_has_course_access(auth.uid(), quizzes.course_id)
);

-- quiz_questions
DROP POLICY IF EXISTS "Everyone can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Enrolled, instructor, admin can view quiz questions" ON public.quiz_questions FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (
    SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.instructor_id = auth.uid() OR public.user_has_course_access(auth.uid(), c.id))
  )
);

-- quiz_options
DROP POLICY IF EXISTS "Everyone can view quiz options" ON public.quiz_options;
CREATE POLICY "Enrolled, instructor, admin can view quiz options" ON public.quiz_options FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    JOIN public.courses c ON c.id = q.course_id
    WHERE qq.id = quiz_options.question_id
      AND (c.instructor_id = auth.uid() OR public.user_has_course_access(auth.uid(), c.id))
  )
);

-- question_bank
DROP POLICY IF EXISTS "Everyone can view question bank" ON public.question_bank;
DROP POLICY IF EXISTS "Everyone can view questions" ON public.question_bank;
CREATE POLICY "Instructor and admin can view question bank" ON public.question_bank FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR instructor_id = auth.uid()
);

-- question_bank_options
DROP POLICY IF EXISTS "Everyone can view question options" ON public.question_bank_options;
CREATE POLICY "Instructor and admin can view question bank options" ON public.question_bank_options FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (
    SELECT 1 FROM public.question_bank qb
    WHERE qb.id = question_bank_options.question_id AND qb.instructor_id = auth.uid()
  )
);

-- assignments
DROP POLICY IF EXISTS "Everyone can view assignments" ON public.assignments;
CREATE POLICY "Enrolled, instructor, admin can view assignments" ON public.assignments FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid())
  OR public.user_has_course_access(auth.uid(), assignments.course_id)
);

-- user_badges
DROP POLICY IF EXISTS "Everyone can view user badges" ON public.user_badges;
CREATE POLICY "Users view own badges, admins view all" ON public.user_badges FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::user_role)
);
