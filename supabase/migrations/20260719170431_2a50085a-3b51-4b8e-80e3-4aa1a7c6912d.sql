
-- 1) courses: instructor cannot delete
DROP POLICY IF EXISTS "Instructors can manage own courses" ON public.courses;
CREATE POLICY "Instructors can insert own courses" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Instructors can update own courses" ON public.courses
  FOR UPDATE TO authenticated
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);

-- 2) chapters
DROP POLICY IF EXISTS "Instructors can manage own course chapters" ON public.chapters;
CREATE POLICY "Instructors can insert chapters for own courses" ON public.chapters
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.instructor_id = auth.uid()));
CREATE POLICY "Instructors can update chapters for own courses" ON public.chapters
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.instructor_id = auth.uid()));

-- 3) chapter_files
DROP POLICY IF EXISTS "Instructors can manage own course chapter files" ON public.chapter_files;
CREATE POLICY "Instructors can insert chapter files" ON public.chapter_files
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapter_files.course_id AND c.instructor_id = auth.uid()));
CREATE POLICY "Instructors can update chapter files" ON public.chapter_files
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapter_files.course_id AND c.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapter_files.course_id AND c.instructor_id = auth.uid()));

-- 4) lesson_attachments
DROP POLICY IF EXISTS "Instructors can manage lesson attachments" ON public.lesson_attachments;
CREATE POLICY "Instructors can insert lesson attachments" ON public.lesson_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_attachments.lesson_id AND c.instructor_id = auth.uid()
  ));
CREATE POLICY "Instructors can update lesson attachments" ON public.lesson_attachments
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_attachments.lesson_id AND c.instructor_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = lesson_attachments.lesson_id AND c.instructor_id = auth.uid()
  ));

-- 5) lessons: drop explicit DELETE for instructor
DROP POLICY IF EXISTS "Instructors can delete lessons for their courses" ON public.lessons;

-- 6) quizzes
DROP POLICY IF EXISTS "Instructors can manage own course quizzes" ON public.quizzes;
CREATE POLICY "Instructors can insert quizzes" ON public.quizzes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = quizzes.course_id AND c.instructor_id = auth.uid()));
CREATE POLICY "Instructors can update quizzes" ON public.quizzes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = quizzes.course_id AND c.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = quizzes.course_id AND c.instructor_id = auth.uid()));

-- 7) quiz_questions
DROP POLICY IF EXISTS "Instructors can manage own quiz questions" ON public.quiz_questions;
CREATE POLICY "Instructors can insert quiz questions" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
  ));
CREATE POLICY "Instructors can update quiz questions" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
  ));

-- 8) quiz_options
DROP POLICY IF EXISTS "Instructors can manage own quiz options" ON public.quiz_options;
CREATE POLICY "Instructors can insert quiz options" ON public.quiz_options
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    JOIN public.courses c ON c.id = q.course_id
    WHERE qq.id = quiz_options.question_id AND c.instructor_id = auth.uid()
  ));
CREATE POLICY "Instructors can update quiz options" ON public.quiz_options
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    JOIN public.courses c ON c.id = q.course_id
    WHERE qq.id = quiz_options.question_id AND c.instructor_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    JOIN public.courses c ON c.id = q.course_id
    WHERE qq.id = quiz_options.question_id AND c.instructor_id = auth.uid()
  ));

-- 9) assignments
DROP POLICY IF EXISTS "Instructors can manage own course assignments" ON public.assignments;
CREATE POLICY "Instructors can insert assignments" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()));
CREATE POLICY "Instructors can update assignments" ON public.assignments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()));
