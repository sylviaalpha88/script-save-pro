
-- 1. Pharmacies table
CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacies TO authenticated;
GRANT ALL ON public.pharmacies TO service_role;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

-- 2. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_director boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_site boolean NOT NULL DEFAULT false;

-- 3. Add pharmacy_id to data tables
ALTER TABLE public.drugs      ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.sales      ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.patients   ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;

-- 4. Wipe legacy demo data (fresh start)
DELETE FROM public.sale_items;
DELETE FROM public.sales;
DELETE FROM public.patients;
DELETE FROM public.drugs;

-- 5. Helper functions
CREATE OR REPLACE FUNCTION public.current_pharmacy_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_director(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT is_director FROM public.profiles WHERE id = _uid), false)
$$;

CREATE OR REPLACE FUNCTION public.can_edit_public_site(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT can_edit_site OR is_director FROM public.profiles WHERE id = _uid), false)
$$;

-- 6. Pharmacies policies
CREATE POLICY "Director manages pharmacies" ON public.pharmacies FOR ALL
  USING (public.is_director(auth.uid())) WITH CHECK (public.is_director(auth.uid()));
CREATE POLICY "Auth read own pharmacy" ON public.pharmacies FOR SELECT
  USING (public.is_director(auth.uid()) OR id = public.current_pharmacy_id());

-- 7. Pharmacy-scoped data policies
DROP POLICY IF EXISTS "Authed read drugs" ON public.drugs;
DROP POLICY IF EXISTS "Inventory/admin write drugs" ON public.drugs;
CREATE POLICY "Pharmacy scope drugs" ON public.drugs FOR ALL
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

DROP POLICY IF EXISTS "Authed manage patients" ON public.patients;
CREATE POLICY "Pharmacy scope patients" ON public.patients FOR ALL
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

DROP POLICY IF EXISTS "Authed read sales" ON public.sales;
DROP POLICY IF EXISTS "Authed create sales" ON public.sales;
CREATE POLICY "Pharmacy scope sales" ON public.sales FOR ALL
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

DROP POLICY IF EXISTS "Authed read sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authed insert sale_items" ON public.sale_items;
CREATE POLICY "Pharmacy scope sale_items" ON public.sale_items FOR ALL
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

-- 8. Profiles policies
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin manage profiles" ON public.profiles;
CREATE POLICY "Read profiles scoped" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_director(auth.uid())
    OR (has_role(auth.uid(),'admin') AND pharmacy_id = public.current_pharmacy_id())
  );
CREATE POLICY "Director manages all profiles" ON public.profiles FOR ALL
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));
CREATE POLICY "Admin manages own-pharmacy staff" ON public.profiles FOR ALL
  USING (has_role(auth.uid(),'admin') AND pharmacy_id = public.current_pharmacy_id() AND role <> 'admin')
  WITH CHECK (has_role(auth.uid(),'admin') AND pharmacy_id = public.current_pharmacy_id() AND role <> 'admin');

-- 9. Site content: anyone with can_edit_site (or director) can write
DROP POLICY IF EXISTS "Admin can update site content" ON public.site_content;
DROP POLICY IF EXISTS "Admin can insert site content" ON public.site_content;
DROP POLICY IF EXISTS "Admin can delete site content" ON public.site_content;
CREATE POLICY "Editors manage site_content" ON public.site_content FOR ALL
  USING (public.can_edit_public_site(auth.uid()))
  WITH CHECK (public.can_edit_public_site(auth.uid()));

-- 10. Seed Vacancy section
INSERT INTO public.site_content (section, title, body, image_url)
VALUES ('vacancy', 'Vacancies', 'No open positions at the moment.', NULL)
ON CONFLICT (section) DO NOTHING;
