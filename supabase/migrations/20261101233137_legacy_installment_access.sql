-- ====================================================================
-- Keep the chapter access that existing installment students already had
--
-- Installments now unlock whole chapters balanced by lesson count (src/lib/installmentAccess.ts).
-- Students who paid before that change keep the number of paid chapters they could already open,
-- without changing paid_percentage (which also drives the price of their next installment).
-- Only admins / the service role may set it.
-- ====================================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS legacy_unlocked_chapters integer;

COMMENT ON COLUMN public.enrollments.legacy_unlocked_chapters IS
  'Paid chapters (in course order) unlocked under the pre-2026-11-02 installment rule; access is the max of this and the current rule.';

CREATE OR REPLACE FUNCTION public.guard_enrollment_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR pg_trigger_depth() > 1
     OR COALESCE(current_setting('app.payment_trusted_write', true), '') = 'on'
     OR public.has_role(auth.uid(), 'admin'::user_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.legacy_unlocked_chapters IS NOT NULL THEN
      RAISE EXCEPTION 'Legacy chapter access can only be set by an admin'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'active' AND NOT public.is_free_course(NEW.course_id) THEN
      RAISE EXCEPTION 'Access to a paid course is only granted after a confirmed payment'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    RAISE EXCEPTION 'Enrollment owner and course cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.legacy_unlocked_chapters IS DISTINCT FROM OLD.legacy_unlocked_chapters THEN
    RAISE EXCEPTION 'Legacy chapter access can only be set by an admin'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'active' AND NOT public.is_free_course(NEW.course_id) THEN
    IF OLD.status IS DISTINCT FROM 'active'
       OR COALESCE(NEW.paid_percentage, 0) > COALESCE(OLD.paid_percentage, 0)
       OR NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'Access to a paid course can only be changed after a confirmed payment'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The five students whose current access is larger than the new rule gives them
UPDATE public.enrollments SET legacy_unlocked_chapters = v.chapters
FROM (VALUES
  ('ba282c98-6d35-4a23-bcc4-e2d2fe48f49f'::uuid, 2), -- Biochemistry, 33% + 66%: whole course
  ('4bd3f359-5351-477e-9bbb-d2f68079c772'::uuid, 2), -- Biochemistry, 66.67%: whole course
  ('020b976b-eeed-4830-a6a6-898e83bc41f3'::uuid, 2), -- General Chemistry, 33%
  ('0b401f2f-6388-4288-8917-7869c3eb0035'::uuid, 3), -- General Chemistry, bundle 50%
  ('4e0994df-8df9-4769-b281-ed279eacd369'::uuid, 4)  -- Organic Chemistry, bundle 50%
) AS v(id, chapters)
WHERE public.enrollments.id = v.id;
