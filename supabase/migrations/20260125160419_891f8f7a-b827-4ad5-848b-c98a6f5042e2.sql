-- Add file_category column to distinguish between course image and course file
ALTER TABLE public.request_files 
ADD COLUMN file_category TEXT DEFAULT 'file' CHECK (file_category IN ('image', 'file'));