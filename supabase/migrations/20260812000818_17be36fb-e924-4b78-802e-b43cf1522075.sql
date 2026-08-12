DROP INDEX IF EXISTS public.instructor_earnings_payment_id_key;

DELETE FROM public.instructor_earnings a
USING public.instructor_earnings b
WHERE a.payment_id IS NOT NULL
  AND a.payment_id = b.payment_id
  AND a.ctid > b.ctid;

ALTER TABLE public.instructor_earnings
  ADD CONSTRAINT instructor_earnings_payment_id_key UNIQUE (payment_id);