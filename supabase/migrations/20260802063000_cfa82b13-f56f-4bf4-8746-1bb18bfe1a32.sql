-- 1) Inventory item / procurement details
ALTER TABLE public.drugs
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Consumables',
  ADD COLUMN IF NOT EXISTS measurement_per_item text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS avg_stock integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_stock integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_ref text,
  ADD COLUMN IF NOT EXISTS lead_time_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS invoice_note_number text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_vat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS computed_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_ordered integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_received integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS manufacture_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'pending';

-- 2) Per-user module access
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access text[] NOT NULL DEFAULT '{}';

-- 3) Vacancies
CREATE TABLE IF NOT EXISTS public.vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_open boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vacancies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacancies TO authenticated;
GRANT ALL ON public.vacancies TO service_role;

ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open vacancies"
  ON public.vacancies FOR SELECT TO anon USING (is_open = true);

CREATE POLICY "Staff view own pharmacy vacancies"
  ON public.vacancies FOR SELECT TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()) OR is_open = true);

CREATE POLICY "Staff manage own pharmacy vacancies"
  ON public.vacancies FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

CREATE TRIGGER touch_vacancies BEFORE UPDATE ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4) Vacancy applications
CREATE TABLE IF NOT EXISTS public.vacancy_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  email text,
  phone text,
  letter_path text,
  cv_path text,
  certificate_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.vacancy_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacancy_applications TO authenticated;
GRANT ALL ON public.vacancy_applications TO service_role;

ALTER TABLE public.vacancy_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can apply"
  ON public.vacancy_applications FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Signed in can apply"
  ON public.vacancy_applications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff view own pharmacy applications"
  ON public.vacancy_applications FOR SELECT TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id());

CREATE POLICY "Staff delete own pharmacy applications"
  ON public.vacancy_applications FOR DELETE TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id());