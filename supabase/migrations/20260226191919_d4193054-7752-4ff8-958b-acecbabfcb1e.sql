
-- Drop the old restrictive SELECT policy for lessons
DROP POLICY IF EXISTS "Enrolled users can view lessons" ON public.lessons;

-- Create a new policy: everyone can view lesson metadata (for course browsing)
CREATE POLICY "Everyone can view lessons metadata"
  ON public.lessons
  FOR SELECT
  USING (true);
