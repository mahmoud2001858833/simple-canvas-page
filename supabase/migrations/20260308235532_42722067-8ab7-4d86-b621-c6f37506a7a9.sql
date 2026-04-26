
-- =============================================
-- PHASE 1: Student Engagement Tables
-- =============================================

-- 1. Gamification Profiles
CREATE TABLE public.gamification_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  total_points integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  last_activity_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all gamification profiles" ON public.gamification_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.gamification_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "System updates gamification via trigger" ON public.gamification_profiles
  FOR UPDATE USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));

-- 2. Badges
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_ar text NOT NULL,
  description text,
  description_ar text,
  icon_url text,
  badge_type text NOT NULL DEFAULT 'achievement',
  requirement_type text NOT NULL DEFAULT 'lessons_completed',
  requirement_value integer NOT NULL DEFAULT 1,
  points_reward integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active badges" ON public.badges
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

-- 3. User Badges
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view user badges" ON public.user_badges
  FOR SELECT USING (true);

CREATE POLICY "System can insert badges" ON public.user_badges
  FOR INSERT WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));

-- 4. Video Notes (Timestamped)
CREATE TABLE public.video_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  timestamp_seconds integer NOT NULL DEFAULT 0,
  note_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.video_notes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own notes" ON public.video_notes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notes" ON public.video_notes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notes" ON public.video_notes
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_video_notes_user_lesson ON public.video_notes(user_id, lesson_id);

-- 5. Study Planner
CREATE TABLE public.study_planner (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  title_ar text,
  scheduled_date date NOT NULL,
  scheduled_time time,
  duration_minutes integer DEFAULT 60,
  is_completed boolean NOT NULL DEFAULT false,
  reminder_sent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.study_planner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own planner" ON public.study_planner
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own events" ON public.study_planner
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events" ON public.study_planner
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own events" ON public.study_planner
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_study_planner_user_date ON public.study_planner(user_id, scheduled_date);

-- 6. Gamification trigger: award points when lesson is completed
CREATE OR REPLACE FUNCTION public.award_points_on_lesson_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when lesson marked as completed
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    -- Upsert gamification profile
    INSERT INTO public.gamification_profiles (user_id, total_points, current_level, last_activity_date)
    VALUES (NEW.user_id, 10, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE SET
      total_points = gamification_profiles.total_points + 10,
      current_level = GREATEST(1, (gamification_profiles.total_points + 10) / 100 + 1),
      last_activity_date = CURRENT_DATE,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_points_on_lesson_complete
  AFTER UPDATE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_lesson_complete();

-- 7. Award points on quiz completion
CREATE OR REPLACE FUNCTION public.award_points_on_quiz_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bonus integer;
BEGIN
  -- Base 20 points + bonus for high scores
  bonus := 20;
  IF NEW.total_questions > 0 AND (NEW.score::numeric / NEW.total_questions) >= 0.8 THEN
    bonus := 50;
  END IF;

  INSERT INTO public.gamification_profiles (user_id, total_points, current_level, last_activity_date)
  VALUES (NEW.user_id, bonus, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = gamification_profiles.total_points + bonus,
    current_level = GREATEST(1, (gamification_profiles.total_points + bonus) / 100 + 1),
    last_activity_date = CURRENT_DATE,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_points_on_quiz_complete
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_quiz_complete();

-- 8. Insert default badges
INSERT INTO public.badges (name, name_ar, description, description_ar, badge_type, requirement_type, requirement_value, points_reward) VALUES
('First Step', 'الخطوة الأولى', 'Complete your first lesson', 'أكمل أول درس لك', 'achievement', 'lessons_completed', 1, 10),
('Dedicated Learner', 'المتعلم المثابر', 'Complete 10 lessons', 'أكمل 10 دروس', 'achievement', 'lessons_completed', 10, 50),
('Knowledge Seeker', 'باحث المعرفة', 'Complete 50 lessons', 'أكمل 50 درسًا', 'achievement', 'lessons_completed', 50, 200),
('Quiz Master', 'خبير الاختبارات', 'Score 80%+ on 5 quizzes', 'احصل على 80%+ في 5 اختبارات', 'achievement', 'quiz_high_scores', 5, 100),
('Course Champion', 'بطل الكورسات', 'Complete an entire course', 'أكمل كورسًا كاملاً', 'achievement', 'courses_completed', 1, 150),
('Rising Star', 'النجم الصاعد', 'Earn 500 points', 'احصل على 500 نقطة', 'milestone', 'total_points', 500, 50),
('Scholar', 'العالم', 'Earn 2000 points', 'احصل على 2000 نقطة', 'milestone', 'total_points', 2000, 200);
