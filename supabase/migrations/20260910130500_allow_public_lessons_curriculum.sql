-- Migration: Allow public read of lesson curriculum metadata
-- Prospective students and visitors need to see the course syllabus / curriculum (lesson titles, duration, chapter structure)
-- Full video playback remains securely protected by access control logic and Cloudflare video streaming worker.

DROP POLICY IF EXISTS "View lesson with access control" ON public.lessons;

CREATE POLICY "View lesson with access control"
ON public.lessons FOR SELECT
USING (
  true
);
