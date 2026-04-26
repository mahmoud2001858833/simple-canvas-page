-- Create table for storing email verification OTP codes
CREATE TABLE public.email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for signup flow - no auth yet)
CREATE POLICY "Anyone can insert verification codes"
ON public.email_verification_codes
FOR INSERT
WITH CHECK (true);

-- Allow reading for verification (will be done via edge function with service role)
CREATE POLICY "Service role can manage verification codes"
ON public.email_verification_codes
FOR ALL
USING (true);

-- Create index for faster email lookups
CREATE INDEX idx_email_verification_email ON public.email_verification_codes(email);

-- Create index for cleanup of expired codes
CREATE INDEX idx_email_verification_expires ON public.email_verification_codes(expires_at);

-- Add function to cleanup old verification codes (called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$;