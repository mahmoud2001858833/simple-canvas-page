
-- Chapter Files table
CREATE TABLE public.chapter_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view chapter files" ON public.chapter_files FOR SELECT USING (true);
CREATE POLICY "Admins can manage chapter files" ON public.chapter_files FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Instructors can manage own course chapter files" ON public.chapter_files FOR ALL USING (
  has_role(auth.uid(), 'instructor'::user_role) AND EXISTS (
    SELECT 1 FROM courses c WHERE c.id = chapter_files.course_id AND c.instructor_id = auth.uid()
  )
);

-- Quizzes table
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  title_ar text NOT NULL DEFAULT '',
  quiz_type text NOT NULL DEFAULT 'interactive' CHECK (quiz_type IN ('pdf', 'interactive')),
  file_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Instructors can manage own course quizzes" ON public.quizzes FOR ALL USING (
  has_role(auth.uid(), 'instructor'::user_role) AND EXISTS (
    SELECT 1 FROM courses c WHERE c.id = quizzes.course_id AND c.instructor_id = auth.uid()
  )
);

-- Quiz Questions table
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  question_ar text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view quiz questions" ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Instructors can manage own quiz questions" ON public.quiz_questions FOR ALL USING (
  has_role(auth.uid(), 'instructor'::user_role) AND EXISTS (
    SELECT 1 FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
  )
);

-- Quiz Options table
CREATE TABLE public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL DEFAULT '',
  option_text_ar text NOT NULL DEFAULT '',
  is_correct boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view quiz options" ON public.quiz_options FOR SELECT USING (true);
CREATE POLICY "Admins can manage quiz options" ON public.quiz_options FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Instructors can manage own quiz options" ON public.quiz_options FOR ALL USING (
  has_role(auth.uid(), 'instructor'::user_role) AND EXISTS (
    SELECT 1 FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id JOIN courses c ON c.id = q.course_id WHERE qq.id = quiz_options.question_id AND c.instructor_id = auth.uid()
  )
);

-- Quiz Attempts table
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts" ON public.quiz_attempts FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Users can insert own attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage attempts" ON public.quiz_attempts FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- Update delete_course_cascade to include new tables
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
  
  DELETE FROM public.lesson_attachments
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  DELETE FROM public.lesson_progress 
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  DELETE FROM public.video_access_logs 
  WHERE lesson_id IN (SELECT id FROM public.lessons WHERE course_id = course_uuid);
  
  DELETE FROM public.lessons WHERE course_id = course_uuid;

  -- Delete quiz attempts for quizzes in this course
  DELETE FROM public.quiz_attempts
  WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE course_id = course_uuid);

  -- Delete quiz options for questions in quizzes of this course
  DELETE FROM public.quiz_options
  WHERE question_id IN (
    SELECT qq.id FROM public.quiz_questions qq
    JOIN public.quizzes q ON q.id = qq.quiz_id
    WHERE q.course_id = course_uuid
  );

  -- Delete quiz questions
  DELETE FROM public.quiz_questions
  WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE course_id = course_uuid);

  -- Delete quizzes
  DELETE FROM public.quizzes WHERE course_id = course_uuid;

  -- Delete chapter files
  DELETE FROM public.chapter_files WHERE course_id = course_uuid;
  
  DELETE FROM public.chapters WHERE course_id = course_uuid;
  DELETE FROM public.enrollments WHERE course_id = course_uuid;
  DELETE FROM public.courses WHERE id = course_uuid;
  
  RETURN TRUE;
END;
$function$;
