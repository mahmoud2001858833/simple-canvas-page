-- ====================================================================
-- Course Community & WhatsApp-Style Group Chat Migration
-- 1. Dedicated tables for course community messages and settings
-- 2. Interactive polls, media attachments, pinning, and moderation
-- 3. Row Level Security for Enrolled Students, Instructors, and Admins
-- 4. Supabase Realtime Publication
-- ====================================================================

-- 1. Course Community Messages Table
CREATE TABLE IF NOT EXISTS public.course_community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'student', -- 'student' | 'instructor' | 'admin'
  sender_name text,
  sender_avatar text,
  content text,
  message_type text NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'file' | 'poll' | 'announcement'
  file_url text,
  file_name text,
  file_size integer,
  poll_data jsonb, -- { question: text, options: [{ id: text, text: text, voter_ids: text[] }], is_multiple: boolean, is_closed: boolean }
  reply_to jsonb,  -- { id: text, sender_name: text, content: text, message_type: text }
  reactions jsonb DEFAULT '{}'::jsonb, -- { emoji: [user_id, ...] }
  is_pinned boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Course Community Settings Table (Controls for Teacher & Admin)
CREATE TABLE IF NOT EXISTS public.course_community_settings (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  allow_student_messages boolean DEFAULT true,
  allow_student_media boolean DEFAULT true,
  is_chat_muted boolean DEFAULT false,
  pinned_message_id uuid REFERENCES public.course_community_messages(id) ON DELETE SET NULL,
  muted_user_ids uuid[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for blazing fast queries and sorting
CREATE INDEX IF NOT EXISTS idx_community_messages_course_created 
  ON public.course_community_messages(course_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_community_messages_sender 
  ON public.course_community_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_community_messages_pinned 
  ON public.course_community_messages(course_id) 
  WHERE is_pinned = true;

-- Enable RLS
ALTER TABLE public.course_community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_community_settings ENABLE ROW LEVEL SECURITY;

-- Helper check function if not exists
CREATE OR REPLACE FUNCTION public.is_user_course_participant(p_course_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Check if user is Super Admin
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role::text = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- 2. Check if user is Course Instructor
  IF EXISTS (
    SELECT 1 FROM public.courses 
    WHERE id = p_course_id AND instructor_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- 3. Check if user has active enrollment
  IF EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE course_id = p_course_id AND user_id = p_user_id AND (status = 'active' OR paid_percentage > 0)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- RLS for course_community_messages
DROP POLICY IF EXISTS "Participants can view community messages" ON public.course_community_messages;
CREATE POLICY "Participants can view community messages"
ON public.course_community_messages FOR SELECT
USING (
  public.is_user_course_participant(course_id, auth.uid())
);

DROP POLICY IF EXISTS "Participants can send community messages" ON public.course_community_messages;
CREATE POLICY "Participants can send community messages"
ON public.course_community_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_user_course_participant(course_id, auth.uid())
);

DROP POLICY IF EXISTS "Instructors and admins can update community messages" ON public.course_community_messages;
CREATE POLICY "Instructors and admins can update community messages"
ON public.course_community_messages FOR UPDATE
USING (
  auth.uid() = sender_id
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
);

DROP POLICY IF EXISTS "Instructors and admins can delete community messages" ON public.course_community_messages;
CREATE POLICY "Instructors and admins can delete community messages"
ON public.course_community_messages FOR DELETE
USING (
  auth.uid() = sender_id
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
);

-- RLS for course_community_settings
DROP POLICY IF EXISTS "Participants can view community settings" ON public.course_community_settings;
CREATE POLICY "Participants can view community settings"
ON public.course_community_settings FOR SELECT
USING (
  public.is_user_course_participant(course_id, auth.uid())
);

DROP POLICY IF EXISTS "Instructors and admins can manage community settings" ON public.course_community_settings;
CREATE POLICY "Instructors and admins can manage community settings"
ON public.course_community_settings FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin')
);

-- Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.course_community_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.course_community_settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
