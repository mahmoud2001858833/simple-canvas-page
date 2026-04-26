-- Add DELETE policy for lessons for admins
CREATE POLICY "Admins can delete lessons"
ON public.lessons
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add has_accepted_policies column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'has_accepted_policies'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN has_accepted_policies boolean DEFAULT false;
  END IF;
END
$$;