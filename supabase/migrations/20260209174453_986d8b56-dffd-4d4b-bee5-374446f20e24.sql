
-- جدول طلبات سحب الأرباح
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  bank_name text,
  iban text,
  account_holder_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  rejection_reason text,
  notes text
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_withdrawal_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_withdrawal_status
  BEFORE INSERT OR UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_withdrawal_status();

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- المعلم يرى طلباته فقط
CREATE POLICY "Instructors view own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));

-- المعلم ينشئ طلب سحب
CREATE POLICY "Instructors create withdrawals"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (instructor_id = auth.uid());

-- الأدمن يدير كل الطلبات
CREATE POLICY "Admins manage withdrawals"
  ON public.withdrawal_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Enable realtime for withdrawal_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
