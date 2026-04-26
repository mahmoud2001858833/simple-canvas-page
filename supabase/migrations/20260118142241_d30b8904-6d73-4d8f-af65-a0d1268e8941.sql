-- Create temp-uploads bucket for temporary video storage before transfer to Bunny
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-uploads', 
  'temp-uploads', 
  false,
  524288000, -- 500MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
);

-- RLS: Admins and instructors can upload to temp-uploads
CREATE POLICY "Admins and instructors can upload temp files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'temp-uploads' 
  AND (
    has_role(auth.uid(), 'admin'::user_role) 
    OR has_role(auth.uid(), 'instructor'::user_role)
  )
);

-- RLS: Users can view their own temp files
CREATE POLICY "Users can view own temp files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'temp-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Service role and admins can delete temp files
CREATE POLICY "Service role can delete temp files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'temp-uploads'
);