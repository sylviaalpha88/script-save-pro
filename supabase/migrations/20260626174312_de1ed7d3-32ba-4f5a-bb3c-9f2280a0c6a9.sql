
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';

CREATE TABLE IF NOT EXISTS public.accountant_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  cash numeric NOT NULL DEFAULT 0,
  mpesa numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountant_reports TO authenticated;
GRANT ALL ON public.accountant_reports TO service_role;

ALTER TABLE public.accountant_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own pharmacy reports"
  ON public.accountant_reports FOR SELECT TO authenticated
  USING (
    public.is_director(auth.uid())
    OR pharmacy_id = public.current_pharmacy_id()
  );

CREATE POLICY "Accountant can insert own pharmacy reports"
  ON public.accountant_reports FOR INSERT TO authenticated
  WITH CHECK (
    pharmacy_id = public.current_pharmacy_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Accountant can update own reports"
  ON public.accountant_reports FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_director(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_director(auth.uid()));

CREATE POLICY "Accountant can delete own reports"
  ON public.accountant_reports FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_director(auth.uid()));
