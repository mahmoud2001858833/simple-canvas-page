ALTER TABLE public.custom_course_requests ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

DROP POLICY IF EXISTS "Users can view request files" ON public.request_files;
CREATE POLICY "Users can view request files"
ON public.request_files
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_course_requests r
  WHERE r.id = request_files.request_id
    AND (
      r.user_id = auth.uid()
      OR r.assigned_instructor_id = auth.uid()
      OR r.assigned_production_id = auth.uid()
      OR r.assigned_secretary_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'secretary'::user_role)
    )
));

CREATE POLICY "Assigned staff can view request student profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.custom_course_requests r
  WHERE r.user_id = profiles.id
    AND (
      r.assigned_instructor_id = auth.uid()
      OR r.assigned_production_id = auth.uid()
      OR r.assigned_secretary_id = auth.uid()
    )
));