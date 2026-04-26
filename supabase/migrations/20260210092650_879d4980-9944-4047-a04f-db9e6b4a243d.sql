
-- Add study_year column to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS study_year text;
