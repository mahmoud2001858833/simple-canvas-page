
-- 1) Fix privilege escalation: remove self-update policy, set fixed default role via trigger
DROP POLICY IF EXISTS "Users can update own role if newly registered" ON public.user_roles;

-- Ensure new users get exactly the 'student' role automatically (idempotent)
CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::user_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_user_role();

-- 2) Fix lessons video URL exposure: replace permissive SELECT policy
DROP POLICY IF EXISTS "Everyone can view lessons metadata" ON public.lessons;

-- Helper: check enrollment
CREATE OR REPLACE FUNCTION public.user_has_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE user_id = _user_id
      AND course_id = _course_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Public can view only preview lessons; enrolled users / instructors / admins see all
CREATE POLICY "View lesson with access control"
ON public.lessons
FOR SELECT
USING (
  is_preview = true
  OR (auth.uid() IS NOT NULL AND public.user_has_course_access(auth.uid(), course_id))
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'instructor'::user_role)
);

-- 3) Restrict gamification_profiles SELECT to owner + admins
DROP POLICY IF EXISTS "Users can view all gamification profiles" ON public.gamification_profiles;

CREATE POLICY "Users can view own gamification profile"
ON public.gamification_profiles
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));
