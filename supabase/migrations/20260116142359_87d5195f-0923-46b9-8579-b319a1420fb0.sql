-- إنشاء جدول رسائل الطلبات
CREATE TABLE public.request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.custom_course_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين لرؤية رسائل طلباتهم
CREATE POLICY "Users can view messages for their requests"
ON public.request_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.custom_course_requests r
    WHERE r.id = request_messages.request_id
    AND (
      r.user_id = auth.uid() OR
      r.assigned_secretary_id = auth.uid() OR
      r.assigned_instructor_id = auth.uid() OR
      r.assigned_production_id = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'secretary')
    )
  )
);

-- سياسة لإضافة رسائل
CREATE POLICY "Users can send messages to their requests"
ON public.request_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.custom_course_requests r
    WHERE r.id = request_messages.request_id
    AND (
      r.user_id = auth.uid() OR
      r.assigned_secretary_id = auth.uid() OR
      r.assigned_instructor_id = auth.uid() OR
      r.assigned_production_id = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'secretary')
    )
  )
);

-- سياسة لتحديث حالة القراءة
CREATE POLICY "Users can mark messages as read"
ON public.request_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.custom_course_requests r
    WHERE r.id = request_messages.request_id
    AND (
      r.user_id = auth.uid() OR
      r.assigned_secretary_id = auth.uid() OR
      r.assigned_instructor_id = auth.uid() OR
      r.assigned_production_id = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'secretary')
    )
  )
);

-- تفعيل Realtime للرسائل
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;

-- فهرس للبحث السريع
CREATE INDEX idx_request_messages_request_id ON public.request_messages(request_id);
CREATE INDEX idx_request_messages_created_at ON public.request_messages(created_at DESC);