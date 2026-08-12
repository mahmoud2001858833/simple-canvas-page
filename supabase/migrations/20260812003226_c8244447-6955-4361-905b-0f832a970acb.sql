DROP INDEX IF EXISTS public.idx_student_refunds_payment;
DELETE FROM public.student_refunds a
USING public.student_refunds b
WHERE a.payment_id IS NOT NULL AND a.payment_id = b.payment_id AND a.ctid > b.ctid;
ALTER TABLE public.student_refunds
  ADD CONSTRAINT student_refunds_payment_id_key UNIQUE (payment_id);