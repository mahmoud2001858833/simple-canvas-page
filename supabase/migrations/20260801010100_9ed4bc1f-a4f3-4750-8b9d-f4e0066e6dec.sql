ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS residence_country text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS education_status text,
  ADD COLUMN IF NOT EXISTS teaching_experience_years text,
  ADD COLUMN IF NOT EXISTS teaching_experience_details text,
  ADD COLUMN IF NOT EXISTS availability_to_start text,
  ADD COLUMN IF NOT EXISTS expected_students_count integer,
  ADD COLUMN IF NOT EXISTS offers_research_services boolean,
  ADD COLUMN IF NOT EXISTS referral_source text;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS learning_outcomes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS learning_outcomes_ar text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS price_includes_tax boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expected_students integer;