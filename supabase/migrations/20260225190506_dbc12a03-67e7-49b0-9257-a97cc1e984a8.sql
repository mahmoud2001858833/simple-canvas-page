
CREATE TABLE public.lesson_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  language TEXT DEFAULT 'ar',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(lesson_id)
);

-- RLS
ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;

-- Students with enrollment can read transcripts
CREATE POLICY "Enrolled users can read transcripts" ON public.lesson_transcripts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.enrollments e ON e.course_id = l.course_id
      WHERE l.id = lesson_transcripts.lesson_id
        AND e.user_id = auth.uid()
        AND e.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_transcripts.lesson_id AND l.is_preview = true
    )
    OR
    has_role(auth.uid(), 'admin'::user_role)
    OR
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = lesson_transcripts.lesson_id AND c.instructor_id = auth.uid()
    )
  );

-- Only service role (edge functions) can insert/update
CREATE POLICY "Service can manage transcripts" ON public.lesson_transcripts
  FOR ALL USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::user_role));
