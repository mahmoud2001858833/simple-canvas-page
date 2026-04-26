-- إصلاح سياسة WITH CHECK (true) في جدول security_audit_logs
-- السماح بالإدراج فقط للمستخدمين المصادق عليهم مع تسجيل user_id الخاص بهم

DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_logs;

-- السماح بالإدراج مع التحقق من أن user_id يطابق المستخدم الحالي
CREATE POLICY "Users can log their own actions"
ON public.security_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());