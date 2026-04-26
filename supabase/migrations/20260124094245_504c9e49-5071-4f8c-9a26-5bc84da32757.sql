-- Add column to allow specific users to login from multiple devices
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS allow_multiple_devices BOOLEAN DEFAULT false;

-- Enable multiple devices for admin account
UPDATE public.profiles 
SET allow_multiple_devices = true 
WHERE email = 'admm@gmail.com';

-- Also clear any existing device sessions for this user
UPDATE public.device_sessions 
SET is_active = false 
WHERE user_id = '6db8e0b2-96bb-44ee-9fe1-d2d6811ace36';