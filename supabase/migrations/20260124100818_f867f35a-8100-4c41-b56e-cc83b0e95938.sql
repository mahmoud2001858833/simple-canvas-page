-- Add approval status for instructor courses
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_courses_approval_status ON public.courses(approval_status);