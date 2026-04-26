-- Allow admins to delete lesson_progress records
CREATE POLICY "Admins can delete lesson progress" 
ON public.lesson_progress 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admins to delete video_access_logs records
CREATE POLICY "Admins can delete video access logs" 
ON public.video_access_logs 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::user_role));