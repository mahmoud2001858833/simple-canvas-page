CREATE TABLE public.instructor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  amount numeric NOT NULL,
  earnings_count integer NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  receipt_url text,
  notes text,
  method text NOT NULL DEFAULT 'bank_transfer',
  status text NOT NULL DEFAULT 'paid',
  created_by uuid,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_payouts TO authenticated;
GRANT ALL ON public.instructor_payouts TO service_role;

ALTER TABLE public.instructor_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage instructor payouts"
ON public.instructor_payouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors view own payouts"
ON public.instructor_payouts FOR SELECT TO authenticated
USING (instructor_id = auth.uid());

CREATE TRIGGER update_instructor_payouts_updated_at
BEFORE UPDATE ON public.instructor_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.instructor_earnings
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.instructor_payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instructor_earnings_payout_id ON public.instructor_earnings(payout_id);
CREATE INDEX IF NOT EXISTS idx_instructor_payouts_instructor ON public.instructor_payouts(instructor_id);

INSERT INTO public.platform_settings (key, value)
VALUES ('instructor_payout_period', 'monthly')
ON CONFLICT (key) DO NOTHING;