-- Fix instructor signup role assignment without allowing admin/self-privilege escalation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role public.user_role;
BEGIN
  requested_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'instructor' THEN 'instructor'::public.user_role
    ELSE 'student'::public.user_role
  END;

  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  -- Public signup may only create student or instructor accounts.
  -- Admin/secretary/production remain admin-assigned only.
  DELETE FROM public.user_roles WHERE user_id = NEW.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP FUNCTION IF EXISTS public.assign_default_user_role();

-- Backfill missing profiles for instructor signups before repairing roles
INSERT INTO public.profiles (id, email, full_name, phone)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  NULLIF(au.raw_user_meta_data->>'phone', '')
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.raw_user_meta_data->>'role' = 'instructor'
  AND p.id IS NULL;

-- Repair instructor signups, but never alter existing privileged/admin users
WITH repair_users AS (
  SELECT au.id
  FROM auth.users au
  WHERE au.raw_user_meta_data->>'role' = 'instructor'
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles privileged
      WHERE privileged.user_id = au.id
        AND privileged.role IN ('admin'::public.user_role, 'secretary'::public.user_role, 'production'::public.user_role)
    )
)
DELETE FROM public.user_roles ur
USING repair_users ru
WHERE ur.user_id = ru.id
  AND ur.role = 'student'::public.user_role;

WITH repair_users AS (
  SELECT au.id
  FROM auth.users au
  WHERE au.raw_user_meta_data->>'role' = 'instructor'
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles privileged
      WHERE privileged.user_id = au.id
        AND privileged.role IN ('admin'::public.user_role, 'secretary'::public.user_role, 'production'::public.user_role)
    )
)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'instructor'::public.user_role
FROM repair_users
ON CONFLICT (user_id, role) DO NOTHING;