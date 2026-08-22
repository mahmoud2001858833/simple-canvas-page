CREATE OR REPLACE FUNCTION public.user_has_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.user_id = _user_id
      AND e.course_id = _course_id
      AND e.status = 'active'
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND (
        -- free course
        COALESCE(c.price, 0) = 0
        -- successful payment for this course
        OR EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.user_id = _user_id
            AND p.course_id = _course_id
            AND p.status = 'paid'
        )
        -- active monthly installment subscription
        OR EXISTS (
          SELECT 1 FROM public.monthly_installments mi
          WHERE mi.user_id = _user_id
            AND mi.course_id = _course_id
            AND mi.status = 'active'
            AND (mi.current_period_end IS NULL OR mi.current_period_end > now())
        )
        -- course included in a completed bundle purchase
        OR EXISTS (
          SELECT 1
          FROM public.bundle_purchases bp
          JOIN public.bundle_courses bc ON bc.bundle_id = bp.bundle_id
          WHERE bp.user_id = _user_id
            AND bc.course_id = _course_id
            AND bp.status IN ('paid', 'completed', 'active')
            AND (bp.expires_at IS NULL OR bp.expires_at > now())
        )
      )
  );
$function$;

-- Align lesson attachments visibility with the same paid-access rule
DROP POLICY IF EXISTS "Users can view lesson attachments" ON public.lesson_attachments;
CREATE POLICY "Users can view lesson attachments"
ON public.lesson_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_attachments.lesson_id
      AND (
        l.is_preview = true
        OR public.user_has_course_access(auth.uid(), l.course_id)
        OR public.has_role(auth.uid(), 'admin'::user_role)
        OR EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = l.course_id AND c.instructor_id = auth.uid()
        )
      )
  )
);