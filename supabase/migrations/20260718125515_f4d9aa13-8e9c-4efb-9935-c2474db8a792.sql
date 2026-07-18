
-- Fix: referral_codes public exposure
DROP POLICY IF EXISTS "Anyone can lookup active codes" ON public.referral_codes;

-- Provide a safe public lookup function for referral codes that returns only minimal fields
CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS TABLE (id uuid, code text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, is_active FROM public.referral_codes
  WHERE UPPER(code) = UPPER(_code) AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon, authenticated;

-- Fix: quiz_options answer key leak - revoke is_correct column read from clients
REVOKE SELECT (is_correct) ON public.quiz_options FROM anon, authenticated;
