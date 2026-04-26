-- Create private storage bucket for course videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-videos', 'course-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated admins and instructors to upload videos
CREATE POLICY "Admins and instructors can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' 
  AND auth.role() = 'authenticated'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
    )
  )
);

-- Policy: Allow admins and instructors to update videos
CREATE POLICY "Admins and instructors can update videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
  )
);

-- Policy: Allow admins and instructors to delete videos
CREATE POLICY "Admins and instructors can delete videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'instructor')
  )
);

-- Policy: Allow authenticated users to view videos (will use signed URLs)
CREATE POLICY "Authenticated users can view course videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-videos'
  AND auth.role() = 'authenticated'
);

-- Create video access logs table for audit trail
CREATE TABLE IF NOT EXISTS public.video_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS on video_access_logs
ALTER TABLE public.video_access_logs ENABLE ROW LEVEL SECURITY;

-- Allow inserting access logs
CREATE POLICY "Allow inserting video access logs"
ON public.video_access_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all access logs
CREATE POLICY "Admins can view video access logs"
ON public.video_access_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);