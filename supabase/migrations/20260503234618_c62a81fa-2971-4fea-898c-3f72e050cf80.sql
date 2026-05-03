-- Auto-update courses.duration_hours from sum of lessons.duration_minutes
CREATE OR REPLACE FUNCTION public.recalc_course_duration(_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_min integer;
BEGIN
  SELECT COALESCE(SUM(duration_minutes), 0) INTO total_min
  FROM public.lessons
  WHERE course_id = _course_id;

  UPDATE public.courses
  SET duration_hours = CEIL(total_min::numeric / 60)::int,
      updated_at = now()
  WHERE id = _course_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lessons_recalc_course_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_course_duration(OLD.course_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_course_duration(NEW.course_id);
    IF TG_OP = 'UPDATE' AND NEW.course_id <> OLD.course_id THEN
      PERFORM public.recalc_course_duration(OLD.course_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_lessons_recalc_course_duration ON public.lessons;
CREATE TRIGGER trg_lessons_recalc_course_duration
AFTER INSERT OR UPDATE OF duration_minutes, course_id OR DELETE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.lessons_recalc_course_duration();

-- Backfill existing courses
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.courses LOOP
    PERFORM public.recalc_course_duration(r.id);
  END LOOP;
END $$;