-- Create wishlist table
CREATE TABLE public.wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Users can view own wishlist
CREATE POLICY "Users can view own wishlist" ON public.wishlist
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can add to own wishlist  
CREATE POLICY "Users can add to own wishlist" ON public.wishlist
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can remove from own wishlist
CREATE POLICY "Users can remove from own wishlist" ON public.wishlist
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage all wishlists
CREATE POLICY "Admins can manage wishlists" ON public.wishlist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));