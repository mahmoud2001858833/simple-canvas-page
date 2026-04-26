-- Add quality variants columns to lessons table
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS video_url_480p TEXT,
ADD COLUMN IF NOT EXISTS video_url_720p TEXT,
ADD COLUMN IF NOT EXISTS video_url_1080p TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.lessons.video_url IS 'Default/original video URL';
COMMENT ON COLUMN public.lessons.video_url_480p IS '480p quality video URL';
COMMENT ON COLUMN public.lessons.video_url_720p IS '720p quality video URL';
COMMENT ON COLUMN public.lessons.video_url_1080p IS '1080p quality video URL';