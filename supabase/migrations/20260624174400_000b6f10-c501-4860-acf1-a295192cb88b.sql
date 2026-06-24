CREATE TABLE public.site_content (
  section text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin can insert site content"
  ON public.site_content FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update site content"
  ON public.site_content FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete site content"
  ON public.site_content FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_content (section, title, body) VALUES
  ('home', 'Welcome to LEMSA Pharmacy', 'Your trusted neighborhood pharmacy.'),
  ('services', 'Our Services', 'Prescription dispensing, retail and wholesale supply, professional consultation.'),
  ('about', 'About LEMSA Pharmacy', 'LEMSA Pharmacy is committed to quality healthcare and customer service.'),
  ('contacts', 'Contact Us', 'Visit us at our pharmacy. Call or email anytime.')
ON CONFLICT (section) DO NOTHING;