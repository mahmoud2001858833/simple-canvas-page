-- Performance indexes for high-traffic queries
-- Optimized for 1000+ concurrent users

-- Index for active courses lookup (frequently queried)
CREATE INDEX IF NOT EXISTS idx_courses_is_active_created 
ON public.courses(is_active, created_at DESC);

-- Composite index for enrollments (user lookups)
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course 
ON public.enrollments(user_id, course_id);

-- Index for lesson progress lookups
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson 
ON public.lesson_progress(user_id, lesson_id);

-- Index for notifications (user-specific, ordered by date)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, is_read, created_at DESC);

-- Index for custom course requests by user
CREATE INDEX IF NOT EXISTS idx_custom_requests_user_status 
ON public.custom_course_requests(user_id, status);

-- Index for request messages
CREATE INDEX IF NOT EXISTS idx_request_messages_request_unread 
ON public.request_messages(request_id, is_read);

-- Index for payments lookup
CREATE INDEX IF NOT EXISTS idx_payments_user_status 
ON public.payments(user_id, status);

-- Index for lessons by course
CREATE INDEX IF NOT EXISTS idx_lessons_course_id 
ON public.lessons(course_id);

-- Index for majors by college
CREATE INDEX IF NOT EXISTS idx_majors_college_active 
ON public.majors(college_id, is_active);

-- Index for colleges by university
CREATE INDEX IF NOT EXISTS idx_colleges_university_active 
ON public.colleges(university_id, is_active);