ALTER TABLE public.drugs
  ADD COLUMN IF NOT EXISTS selling_price_retail numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price_wholesale numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_min_qty integer NOT NULL DEFAULT 10;

UPDATE public.drugs
SET selling_price_retail = CASE WHEN selling_price_retail = 0 THEN selling_price ELSE selling_price_retail END,
    selling_price_wholesale = CASE WHEN selling_price_wholesale = 0 THEN selling_price ELSE selling_price_wholesale END;