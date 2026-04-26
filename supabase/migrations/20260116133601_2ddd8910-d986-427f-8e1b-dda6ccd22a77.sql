-- Fix profiles table - add restrictive policy for unauthenticated users
-- First, let's update the profiles RLS to be more secure

-- Drop existing policies if they exist (we'll recreate them properly)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create more secure policies that explicitly require authentication
CREATE POLICY "Authenticated users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Fix payments table - add more restrictive policies
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

-- Create more secure policies for payments
CREATE POLICY "Authenticated users can view own payments" 
ON public.payments 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated admins can view all payments" 
ON public.payments 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can insert own payments" 
ON public.payments 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated admins can manage payments" 
ON public.payments 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add service role policy for webhook to update payments
CREATE POLICY "Service role can manage payments" 
ON public.payments 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);