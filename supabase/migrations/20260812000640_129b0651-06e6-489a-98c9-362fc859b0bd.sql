DELETE FROM public.instructor_earnings a
USING public.instructor_earnings b
WHERE a.payment_id IS NOT NULL
  AND a.payment_id = b.payment_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS instructor_earnings_payment_id_key
  ON public.instructor_earnings (payment_id)
  WHERE payment_id IS NOT NULL;