CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit public.drug_unit NOT NULL DEFAULT 'piece',
  selling_price_retail numeric NOT NULL DEFAULT 0,
  selling_price_wholesale numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX services_pharmacy_name_key ON public.services (pharmacy_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy staff manage their services" ON public.services
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());
CREATE TRIGGER services_touch BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();