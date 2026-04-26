
-- Fix 1: Lock down email_verification_codes table
-- Edge functions use service role key which bypasses RLS, so this won't break functionality
DROP POLICY IF EXISTS "Anyone can insert verification codes" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Service role can manage verification codes" ON public.email_verification_codes;

-- Block all direct access - only edge functions with service role can access
CREATE POLICY "No direct access to verification codes"
ON public.email_verification_codes
FOR ALL
USING (false)
WITH CHECK (false);
