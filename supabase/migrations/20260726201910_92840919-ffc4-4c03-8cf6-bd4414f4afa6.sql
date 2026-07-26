ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS enabled_payment_methods TEXT[]
  NOT NULL DEFAULT ARRAY['alinmapay','bank_transfer','tabby','paytabs']::text[];

-- Backfill any existing rows that somehow have NULL (safety)
UPDATE public.courses
  SET enabled_payment_methods = ARRAY['alinmapay','bank_transfer','tabby','paytabs']::text[]
  WHERE enabled_payment_methods IS NULL OR array_length(enabled_payment_methods, 1) IS NULL;