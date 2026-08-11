ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS national_id text;

CREATE TABLE IF NOT EXISTS public.xapi_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  verb text not null,
  course_id uuid,
  statement jsonb not null,
  status_code integer,
  response text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

GRANT ALL ON public.xapi_statements TO service_role;
GRANT SELECT ON public.xapi_statements TO authenticated;
ALTER TABLE public.xapi_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view xapi statements" ON public.xapi_statements;
CREATE POLICY "Admins can view xapi statements" ON public.xapi_statements
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_xapi_statements_created_at ON public.xapi_statements (created_at DESC);