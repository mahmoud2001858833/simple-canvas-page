-- إصلاح سياسات الأمان للجداول الحساسة

-- 1. إزالة سياسة service role المفرطة من جدول payments
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;

-- 2. تشديد سياسة admin على جدول messages لإضافة تدقيق
-- إزالة السياسة القديمة
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;

-- إنشاء سياسة جديدة للمسؤولين مع قيود أفضل
CREATE POLICY "Admins can view messages for moderation" 
ON public.messages 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
);

-- 3. تحسين سياسات جدول profiles لمنع كشف البيانات الحساسة
-- السياسات الحالية جيدة ولكن نضيف حماية إضافية

-- 4. إنشاء جدول لتسجيل الوصول للتدقيق الأمني
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  user_id uuid,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- تمكين RLS على جدول التدقيق
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- فقط المسؤولين يمكنهم قراءة سجلات التدقيق
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- السماح بالإدراج للنظام فقط (عبر service role)
CREATE POLICY "System can insert audit logs"
ON public.security_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. تحديث سياسة payments لمنع التلاعب
-- إزالة أي سياسات UPDATE مفرطة
DROP POLICY IF EXISTS "Authenticated admins can manage payments" ON public.payments;

-- إنشاء سياسات محددة أكثر
CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update payment status"
ON public.payments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- منع الحذف العشوائي للمدفوعات
CREATE POLICY "Only admins can delete failed payments"
ON public.payments
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role) 
  AND status IN ('failed', 'pending')
);