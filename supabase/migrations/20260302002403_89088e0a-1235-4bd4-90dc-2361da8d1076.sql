-- Allow students to update their own enrollment progress
CREATE POLICY "Students can update own enrollment progress"
ON public.enrollments FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix course_reviews INSERT policy: require active enrollment only, not 100% progress
DROP POLICY IF EXISTS "Students can create reviews" ON public.course_reviews;
CREATE POLICY "Students can create reviews"
ON public.course_reviews FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = course_reviews.course_id
    AND enrollments.user_id = auth.uid()
    AND enrollments.status = 'active'
  )
);