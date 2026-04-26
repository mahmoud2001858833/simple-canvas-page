
-- Add new columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teaching_year text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS study_year text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS research_participation boolean DEFAULT null;

-- Add slug column to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slug text UNIQUE;
