-- Create table for screen capture attempts
CREATE TABLE public.screen_capture_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL, -- 'keyboard_shortcut', 'window_blur', 'pip_attempt', 'visibility_change'
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.screen_capture_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view capture attempts
CREATE POLICY "Admins can view capture attempts"
ON public.screen_capture_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Policy: Authenticated users can log their own attempts (for tracking)
CREATE POLICY "Users can log capture attempts"
ON public.screen_capture_attempts
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Admins can delete old logs
CREATE POLICY "Admins can delete capture attempts"
ON public.screen_capture_attempts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Create function to notify admins about capture attempts
CREATE OR REPLACE FUNCTION public.notify_admins_capture_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user RECORD;
  attempt_type_ar TEXT;
  attempt_type_en TEXT;
BEGIN
  -- Map attempt types to readable text
  CASE NEW.attempt_type
    WHEN 'keyboard_shortcut' THEN
      attempt_type_ar := 'اختصار لوحة المفاتيح';
      attempt_type_en := 'Keyboard Shortcut';
    WHEN 'window_blur' THEN
      attempt_type_ar := 'خروج من النافذة';
      attempt_type_en := 'Window Blur';
    WHEN 'pip_attempt' THEN
      attempt_type_ar := 'محاولة صورة في صورة';
      attempt_type_en := 'Picture-in-Picture Attempt';
    WHEN 'visibility_change' THEN
      attempt_type_ar := 'تغيير الرؤية';
      attempt_type_en := 'Visibility Change';
    ELSE
      attempt_type_ar := NEW.attempt_type;
      attempt_type_en := NEW.attempt_type;
  END CASE;

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
      '⚠️ Screen Capture Attempt Detected',
      '⚠️ محاولة التقاط شاشة',
      'User ' || COALESCE(NEW.user_name, NEW.user_email, 'Unknown') || ' attempted screen capture (' || attempt_type_en || ')',
      'المستخدم ' || COALESCE(NEW.user_name, NEW.user_email, 'غير معروف') || ' حاول التقاط الشاشة (' || attempt_type_ar || ')',
      'warning',
      '/admin?tab=logs'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to notify admins
CREATE TRIGGER on_capture_attempt_notify_admins
AFTER INSERT ON public.screen_capture_attempts
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_capture_attempt();

-- Add index for faster queries
CREATE INDEX idx_capture_attempts_user_id ON public.screen_capture_attempts(user_id);
CREATE INDEX idx_capture_attempts_created_at ON public.screen_capture_attempts(created_at DESC);