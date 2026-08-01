ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS monthly_installment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_installment_months integer NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.monthly_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  total_months integer NOT NULL DEFAULT 3,
  months_paid integer NOT NULL DEFAULT 0,
  monthly_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  status text NOT NULL DEFAULT 'active',
  last_payment_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT, UPDATE ON public.monthly_installments TO authenticated;
GRANT ALL ON public.monthly_installments TO service_role;

ALTER TABLE public.monthly_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own monthly installments"
ON public.monthly_installments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all monthly installments"
ON public.monthly_installments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role) OR public.has_role(auth.uid(), 'secretary'::user_role));

CREATE POLICY "Admins manage monthly installments"
ON public.monthly_installments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

CREATE TRIGGER update_monthly_installments_updated_at
BEFORE UPDATE ON public.monthly_installments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();