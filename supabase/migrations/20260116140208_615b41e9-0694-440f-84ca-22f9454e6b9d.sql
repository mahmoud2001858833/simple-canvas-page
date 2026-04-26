-- 1. إضافة سياسة للأدمن لمشاهدة جميع الـ user_roles مع profiles
-- هذا ضروري لأن الأدمن يحتاج لقراءة الأدوار عند عرض المستخدمين
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role) 
  OR user_id = auth.uid()
);

-- 2. تحديث سياسة profiles للأدمن لتشمل secretary أيضاً
DROP POLICY IF EXISTS "Authenticated admins can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'secretary'::user_role)
);

-- 3. التأكد من سياسة الإنشاء على custom_course_requests
DROP POLICY IF EXISTS "Users can create requests" ON public.custom_course_requests;
CREATE POLICY "Authenticated users can create requests"
ON public.custom_course_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. إضافة سياسة عرض لجميع الملفات للأدمن والسكرتارية
DROP POLICY IF EXISTS "Users can view request files" ON public.request_files;
CREATE POLICY "Users can view request files"
ON public.request_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM custom_course_requests r
    WHERE r.id = request_files.request_id 
    AND (
      r.user_id = auth.uid() 
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'secretary'::user_role)
    )
  )
);

-- 5. تأكيد سياسة إدراج الملفات
DROP POLICY IF EXISTS "Users can insert request files" ON public.request_files;
CREATE POLICY "Authenticated users can insert request files"
ON public.request_files
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM custom_course_requests r
    WHERE r.id = request_files.request_id AND r.user_id = auth.uid()
  )
);