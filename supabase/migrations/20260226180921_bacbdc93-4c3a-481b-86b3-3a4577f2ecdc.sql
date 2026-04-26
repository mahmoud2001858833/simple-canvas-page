
-- Create course_messages table
CREATE TABLE public.course_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text,
  file_url text,
  file_name text,
  file_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.course_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: enrolled student OR course instructor OR admin
CREATE POLICY "Users can view course messages" ON public.course_messages
FOR SELECT USING (
  (sender_id = auth.uid() OR receiver_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::user_role)
  OR EXISTS (
    SELECT 1 FROM courses c WHERE c.id = course_messages.course_id AND c.instructor_id = auth.uid()
  )
);

-- INSERT: enrolled student OR course instructor OR admin (sender_id must be auth.uid())
CREATE POLICY "Users can send course messages" ON public.course_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM enrollments e 
      WHERE e.course_id = course_messages.course_id AND e.user_id = auth.uid() AND e.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_messages.course_id AND c.instructor_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::user_role)
  )
);

-- UPDATE: receiver can mark as read
CREATE POLICY "Receiver can mark messages as read" ON public.course_messages
FOR UPDATE USING (receiver_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_messages;

-- Add UPDATE policy for messages table (needed for marking as read)
CREATE POLICY "Users can mark messages as read" ON public.messages
FOR UPDATE USING (receiver_id = auth.uid());
