-- Add columns for deadline tracking
ALTER TABLE public.custom_course_requests 
ADD COLUMN IF NOT EXISTS deadline_warning_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMPTZ DEFAULT NOW();

-- Create function to update last_status_update timestamp
CREATE OR REPLACE FUNCTION public.update_request_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_update = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-update last_status_update
DROP TRIGGER IF EXISTS update_request_status_timestamp_trigger ON public.custom_course_requests;
CREATE TRIGGER update_request_status_timestamp_trigger
BEFORE UPDATE ON public.custom_course_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_request_status_timestamp();

-- Create function to auto-detect and update delayed requests
CREATE OR REPLACE FUNCTION public.check_request_deadlines()
RETURNS void AS $$
DECLARE
  request_record RECORD;
  days_until_deadline INTEGER;
  notification_title TEXT;
  notification_title_ar TEXT;
  notification_message TEXT;
  notification_message_ar TEXT;
BEGIN
  -- Loop through all non-completed requests with deadlines
  FOR request_record IN 
    SELECT id, user_id, title, deadline, status, deadline_warning_sent
    FROM public.custom_course_requests 
    WHERE status NOT IN ('completed') 
      AND deadline IS NOT NULL
  LOOP
    days_until_deadline := EXTRACT(DAY FROM (request_record.deadline - NOW()));
    
    -- If deadline passed and not already marked as delayed/urgent
    IF request_record.deadline < NOW() AND request_record.status NOT IN ('delayed', 'urgent') THEN
      -- Update to delayed status
      UPDATE public.custom_course_requests 
      SET status = 'delayed'
      WHERE id = request_record.id;
      
      -- Send notification
      INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
      VALUES (
        request_record.user_id,
        'Request Deadline Passed',
        'انتهى موعد التسليم',
        'Your request "' || request_record.title || '" has passed its deadline.',
        'طلبك "' || request_record.title || '" تجاوز موعد التسليم المحدد.',
        'warning',
        '/dashboard'
      );
      
    -- If deadline is within 2 days and warning not sent
    ELSIF days_until_deadline <= 2 AND days_until_deadline > 0 AND NOT request_record.deadline_warning_sent THEN
      -- Mark warning as sent
      UPDATE public.custom_course_requests 
      SET deadline_warning_sent = TRUE
      WHERE id = request_record.id;
      
      -- Send warning notification
      INSERT INTO public.notifications (user_id, title, title_ar, message, message_ar, type, link)
      VALUES (
        request_record.user_id,
        'Deadline Approaching',
        'اقتراب موعد التسليم',
        'Your request "' || request_record.title || '" is due in ' || days_until_deadline || ' day(s).',
        'طلبك "' || request_record.title || '" متبقي على موعد تسليمه ' || days_until_deadline || ' يوم/أيام.',
        'warning',
        '/dashboard'
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;