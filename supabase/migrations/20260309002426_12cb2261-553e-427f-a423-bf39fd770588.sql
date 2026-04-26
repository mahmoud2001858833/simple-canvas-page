
-- Question Bank table for instructors
CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  instructor_id UUID NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  question TEXT NOT NULL DEFAULT '',
  question_ar TEXT NOT NULL DEFAULT ''
);

-- Question Bank Options
CREATE TABLE public.question_bank_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  option_text TEXT NOT NULL DEFAULT '',
  option_text_ar TEXT NOT NULL DEFAULT ''
);

-- Enable RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_options ENABLE ROW LEVEL SECURITY;

-- RLS for question_bank
CREATE POLICY "Admins can manage question bank"
ON public.question_bank FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Instructors can manage own questions"
ON public.question_bank FOR ALL
USING (has_role(auth.uid(), 'instructor'::user_role) AND instructor_id = auth.uid());

CREATE POLICY "Everyone can view questions"
ON public.question_bank FOR SELECT
USING (true);

-- RLS for question_bank_options
CREATE POLICY "Admins can manage question bank options"
ON public.question_bank_options FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Instructors can manage own question options"
ON public.question_bank_options FOR ALL
USING (has_role(auth.uid(), 'instructor'::user_role) AND EXISTS (
  SELECT 1 FROM public.question_bank q WHERE q.id = question_bank_options.question_id AND q.instructor_id = auth.uid()
));

CREATE POLICY "Everyone can view question options"
ON public.question_bank_options FOR SELECT
USING (true);

-- Indexes
CREATE INDEX idx_question_bank_course ON public.question_bank(course_id);
CREATE INDEX idx_question_bank_instructor ON public.question_bank(instructor_id);
CREATE INDEX idx_question_bank_chapter ON public.question_bank(chapter_id);
CREATE INDEX idx_question_bank_options_question ON public.question_bank_options(question_id);

-- Updated_at trigger
CREATE TRIGGER update_question_bank_updated_at
BEFORE UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
