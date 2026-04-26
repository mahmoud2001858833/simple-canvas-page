-- Create function to send notification on request status change
CREATE OR REPLACE FUNCTION public.notify_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_text_ar TEXT;
  status_text_en TEXT;
  notification_type TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Map status to Arabic/English text
    CASE NEW.status
      WHEN 'pending' THEN
        status_text_ar := 'قيد الانتظار';
        status_text_en := 'Pending';
        notification_type := 'info';
      WHEN 'in_progress' THEN
        status_text_ar := 'قيد التنفيذ';
        status_text_en := 'In Progress';
        notification_type := 'info';
      WHEN 'delayed' THEN
        status_text_ar := 'متأخر';
        status_text_en := 'Delayed';
        notification_type := 'warning';
      WHEN 'urgent' THEN
        status_text_ar := 'عاجل';
        status_text_en := 'Urgent';
        notification_type := 'warning';
      WHEN 'completed' THEN
        status_text_ar := 'مكتمل';
        status_text_en := 'Completed';
        notification_type := 'success';
      ELSE
        status_text_ar := NEW.status::TEXT;
        status_text_en := NEW.status::TEXT;
        notification_type := 'info';
    END CASE;

    -- Insert notification for the request owner
    INSERT INTO public.notifications (
      user_id,
      title,
      title_ar,
      message,
      message_ar,
      type,
      link
    ) VALUES (
      NEW.user_id,
      'Request Status Updated',
      'تم تحديث حالة الطلب',
      'Your request "' || NEW.title || '" status has been updated to: ' || status_text_en,
      'تم تحديث حالة طلبك "' || NEW.title || '" إلى: ' || status_text_ar,
      notification_type,
      '/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on custom_course_requests table
DROP TRIGGER IF EXISTS on_request_status_change ON public.custom_course_requests;

CREATE TRIGGER on_request_status_change
  AFTER UPDATE ON public.custom_course_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_status_change();