
-- Owner-based access for private buckets (path convention: <user_id>/...)
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['course-videos','assignment-files','payment-receipts','request-files','temp-uploads']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR SELECT
      USING (bucket_id = %L AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::user_role)));
    $f$, b || '_select_own', b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = %L AND auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b || '_insert_own', b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR UPDATE
      USING (bucket_id = %L AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::user_role)));
    $f$, b || '_update_own', b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR DELETE
      USING (bucket_id = %L AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::user_role)));
    $f$, b || '_delete_own', b);
  END LOOP;
END $$;

-- Public buckets: public read, authenticated upload/manage own
CREATE POLICY "chat-images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-images');
CREATE POLICY "chat-images authenticated insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "lesson-files public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'lesson-files');
CREATE POLICY "lesson-files instructor/admin manage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'lesson-files' AND (
      public.has_role(auth.uid(), 'admin'::user_role) OR
      public.has_role(auth.uid(), 'instructor'::user_role)
    )
  ) WITH CHECK (
    bucket_id = 'lesson-files' AND (
      public.has_role(auth.uid(), 'admin'::user_role) OR
      public.has_role(auth.uid(), 'instructor'::user_role)
    )
  );
