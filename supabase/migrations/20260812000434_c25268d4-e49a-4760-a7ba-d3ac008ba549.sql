CREATE POLICY "Admins can insert payments for any user"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));