-- Promote specified users to admin role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::user_role
FROM auth.users u
WHERE u.email IN ('admm@gmail.com', 'jowmahmoud6@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove the default 'student' role from these users so they only have admin
DELETE FROM public.user_roles
WHERE role = 'student'
  AND user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('admm@gmail.com', 'jowmahmoud6@gmail.com')
  );