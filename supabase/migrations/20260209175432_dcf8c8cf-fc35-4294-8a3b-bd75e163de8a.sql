
-- Course reviews table
CREATE TABLE public.course_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, user_id)
);

-- Enable RLS
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can view reviews
CREATE POLICY "Anyone can view reviews"
  ON public.course_reviews FOR SELECT
  USING (true);

-- Students can create reviews for courses they completed
CREATE POLICY "Students can create reviews"
  ON public.course_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = course_reviews.course_id
        AND enrollments.user_id = auth.uid()
        AND enrollments.progress >= 100
    )
  );

-- Students can update their own reviews
CREATE POLICY "Students can update own reviews"
  ON public.course_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Students can delete their own reviews, admins can delete any
CREATE POLICY "Delete own or admin"
  ON public.course_reviews FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_course_reviews_updated_at
  BEFORE UPDATE ON public.course_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_reviews;

-- Index for performance
CREATE INDEX idx_course_reviews_course_id ON public.course_reviews(course_id);
CREATE INDEX idx_course_reviews_user_id ON public.course_reviews(user_id);
