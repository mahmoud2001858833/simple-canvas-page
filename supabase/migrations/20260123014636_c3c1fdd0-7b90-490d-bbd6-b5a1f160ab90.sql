-- Add RLS policies for instructors to manage lessons for their own courses

-- Policy for instructors to INSERT lessons for their courses
CREATE POLICY "Instructors can create lessons for their courses"
ON public.lessons
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'instructor'::user_role) 
  AND EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = course_id 
    AND c.instructor_id = auth.uid()
  )
);

-- Policy for instructors to UPDATE lessons for their courses
CREATE POLICY "Instructors can update lessons for their courses"
ON public.lessons
FOR UPDATE
USING (
  has_role(auth.uid(), 'instructor'::user_role) 
  AND EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = course_id 
    AND c.instructor_id = auth.uid()
  )
);

-- Policy for instructors to DELETE lessons for their courses
CREATE POLICY "Instructors can delete lessons for their courses"
ON public.lessons
FOR DELETE
USING (
  has_role(auth.uid(), 'instructor'::user_role) 
  AND EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = course_id 
    AND c.instructor_id = auth.uid()
  )
);