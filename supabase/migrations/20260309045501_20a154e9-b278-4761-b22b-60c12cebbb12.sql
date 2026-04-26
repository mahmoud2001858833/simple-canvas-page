CREATE POLICY "Users can update own payment receipt"
ON public.payments
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());