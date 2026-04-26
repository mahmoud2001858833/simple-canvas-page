-- Allow newly registered users to update their own role within the first 5 minutes of account creation
-- This is necessary because the signup flow lets users choose instructor role

-- First, create a function to check if user is newly registered (within 5 minutes)
CREATE OR REPLACE FUNCTION public.is_newly_registered_user(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = check_user_id 
    AND created_at > (now() - interval '5 minutes')
  );
$$;

-- Add policy to allow users to update their own role only if they are newly registered
CREATE POLICY "Users can update own role if newly registered" 
ON public.user_roles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id AND public.is_newly_registered_user(auth.uid()))
WITH CHECK (auth.uid() = user_id AND public.is_newly_registered_user(auth.uid()));