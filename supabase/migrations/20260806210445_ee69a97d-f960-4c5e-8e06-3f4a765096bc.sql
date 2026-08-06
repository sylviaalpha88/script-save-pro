
ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.site_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_path text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_downloads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_downloads TO authenticated;
GRANT ALL ON public.site_downloads TO service_role;
ALTER TABLE public.site_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view downloads" ON public.site_downloads FOR SELECT USING (true);
CREATE POLICY "Site editors manage downloads" ON public.site_downloads FOR ALL TO authenticated
  USING (public.can_edit_public_site(auth.uid())) WITH CHECK (public.can_edit_public_site(auth.uid()));

CREATE POLICY "Public read downloads bucket" ON storage.objects FOR SELECT USING (bucket_id = 'downloads');
CREATE POLICY "Site editors upload downloads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'downloads' AND public.can_edit_public_site(auth.uid()));
CREATE POLICY "Site editors delete downloads" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'downloads' AND public.can_edit_public_site(auth.uid()));

CREATE TABLE IF NOT EXISTS public.stock_order_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  drug_id uuid,
  drug_name text NOT NULL,
  sku text,
  category text,
  department text,
  measurement_per_item text,
  remaining integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  avg_stock integer NOT NULL DEFAULT 0,
  max_stock integer NOT NULL DEFAULT 0,
  order_qty integer NOT NULL DEFAULT 0,
  supplier_name text,
  level text,
  moved_by uuid,
  moved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_order_archive TO authenticated;
GRANT ALL ON public.stock_order_archive TO service_role;
ALTER TABLE public.stock_order_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacy staff manage their stock order history" ON public.stock_order_archive
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());
