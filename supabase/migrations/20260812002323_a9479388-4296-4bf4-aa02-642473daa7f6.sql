CREATE POLICY "Instructors can view their payout receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.instructor_payouts p
    WHERE p.instructor_id = auth.uid()
      AND p.receipt_url = storage.objects.name
  )
);