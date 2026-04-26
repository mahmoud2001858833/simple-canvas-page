-- إضافة Foreign Key من user_roles.user_id إلى profiles.id
ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_user_id_profiles_fkey;

ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;