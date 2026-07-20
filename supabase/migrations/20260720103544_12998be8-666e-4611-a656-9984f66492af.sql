
-- Allow admins to manage all courses
CREATE POLICY "Admins can insert courses"
ON public.courses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update courses"
ON public.courses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all courses"
ON public.courses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view own courses"
ON public.courses FOR SELECT TO authenticated
USING (auth.uid() = instructor_id);
