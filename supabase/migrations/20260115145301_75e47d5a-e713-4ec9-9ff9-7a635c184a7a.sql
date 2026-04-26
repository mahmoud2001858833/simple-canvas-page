-- إضافة سياسات للسماح للمشرفين برؤية جميع الملفات الشخصية
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين بتعديل الملفات الشخصية
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين بإدارة التسجيلات
CREATE POLICY "Admins can update enrollments" ON public.enrollments
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete enrollments" ON public.enrollments
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين بإدارة الدروس
CREATE POLICY "Admins can manage lessons" ON public.lessons
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين بإدارة الشهادات
CREATE POLICY "Admins can manage certificates" ON public.certificates
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين بإدارة أرباح المدرسين
CREATE POLICY "Admins can manage instructor earnings" ON public.instructor_earnings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين بإدارة الإشعارات
CREATE POLICY "Admins can manage notifications" ON public.notifications
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- السماح للمشرفين برؤية جميع الرسائل
CREATE POLICY "Admins can view all messages" ON public.messages
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));