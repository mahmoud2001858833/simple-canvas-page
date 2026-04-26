-- Create support_chats table to store chat sessions
CREATE TABLE public.support_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create support_messages table to store individual messages
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.support_chats(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'assistant', 'admin')),
  sender_id UUID,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_chats
-- Users can see their own chats
CREATE POLICY "Users can view their own support chats"
ON public.support_chats FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own chats
CREATE POLICY "Users can create their own support chats"
ON public.support_chats FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own chats
CREATE POLICY "Users can update their own support chats"
ON public.support_chats FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all chats
CREATE POLICY "Admins can view all support chats"
ON public.support_chats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admins can update all chats
CREATE POLICY "Admins can update all support chats"
ON public.support_chats FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS policies for support_messages
-- Users can see messages in their chats
CREATE POLICY "Users can view messages in their chats"
ON public.support_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_chats 
    WHERE id = chat_id AND user_id = auth.uid()
  )
);

-- Users can insert messages in their chats
CREATE POLICY "Users can insert messages in their chats"
ON public.support_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_chats 
    WHERE id = chat_id AND user_id = auth.uid()
  )
);

-- Admins can view all messages
CREATE POLICY "Admins can view all support messages"
ON public.support_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admins can insert messages
CREATE POLICY "Admins can insert support messages"
ON public.support_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admins can update messages (mark as read)
CREATE POLICY "Admins can update support messages"
ON public.support_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Enable realtime for support messages (for admin notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;

-- Create index for faster queries
CREATE INDEX idx_support_chats_user_id ON public.support_chats(user_id);
CREATE INDEX idx_support_chats_status ON public.support_chats(status);
CREATE INDEX idx_support_messages_chat_id ON public.support_messages(chat_id);
CREATE INDEX idx_support_messages_is_read ON public.support_messages(is_read);

-- Function to notify admins when new support message arrives
CREATE OR REPLACE FUNCTION notify_admins_new_support_message()
RETURNS TRIGGER AS $$
DECLARE
  admin_user RECORD;
  chat_record RECORD;
BEGIN
  -- Only notify for user messages
  IF NEW.sender_type = 'user' THEN
    -- Get chat details
    SELECT * INTO chat_record FROM public.support_chats WHERE id = NEW.chat_id;
    
    -- Insert notification for each admin
    FOR admin_user IN 
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        user_id,
        title,
        title_ar,
        message,
        message_ar,
        type,
        link
      ) VALUES (
        admin_user.user_id,
        'New Support Message',
        'رسالة دعم جديدة',
        'New message from ' || COALESCE(chat_record.user_name, 'Guest'),
        'رسالة جديدة من ' || COALESCE(chat_record.user_name, 'زائر'),
        'info',
        '/admin-dashboard?tab=support'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new support messages
CREATE TRIGGER on_new_support_message
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION notify_admins_new_support_message();