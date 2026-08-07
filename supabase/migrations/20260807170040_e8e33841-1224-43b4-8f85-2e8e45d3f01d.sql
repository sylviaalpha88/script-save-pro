ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS postal_address text;

ALTER TABLE public.vacancy_applications ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE POLICY "Staff update own pharmacy applications"
  ON public.vacancy_applications FOR UPDATE TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

CREATE TABLE public.printed_docs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  title text NOT NULL,
  html text NOT NULL,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.printed_docs TO authenticated;
GRANT SELECT ON public.printed_docs TO anon;
GRANT ALL ON public.printed_docs TO service_role;

ALTER TABLE public.printed_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read a printed document by link"
  ON public.printed_docs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Staff create printed documents"
  ON public.printed_docs FOR INSERT TO authenticated
  WITH CHECK (pharmacy_id IS NULL OR pharmacy_id = public.current_pharmacy_id());