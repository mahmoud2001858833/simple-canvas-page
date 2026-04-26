-- Create storage bucket for request files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'request-files', 
  'request-files', 
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
);

-- Storage policies for request files
CREATE POLICY "Users can upload request files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'request-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view own request files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'request-files' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'secretary')
  )
);

CREATE POLICY "Users can delete own request files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'request-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);