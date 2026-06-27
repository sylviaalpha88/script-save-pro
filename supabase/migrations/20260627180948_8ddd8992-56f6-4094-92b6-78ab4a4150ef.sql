
-- 1) New role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'buyer';

-- 2) wholesale_buyers
CREATE TABLE IF NOT EXISTS public.wholesale_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL,
  id_number text,
  phone text,
  location text,
  license_number text,
  license_pdf_path text,
  email text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesale_buyers TO authenticated;
GRANT ALL ON public.wholesale_buyers TO service_role;
ALTER TABLE public.wholesale_buyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer reads own row" ON public.wholesale_buyers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()));

CREATE POLICY "buyer updates own row" ON public.wholesale_buyers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()));

CREATE POLICY "staff manages buyers" ON public.wholesale_buyers
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()))
  WITH CHECK (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()));

-- 3) buyer_orders
CREATE TABLE IF NOT EXISTS public.buyer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.wholesale_buyers(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | reviewed | paid | cancelled
  payment_status text NOT NULL DEFAULT 'unpaid', -- unpaid | paid
  payment_method text,
  amount_paid numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_orders TO authenticated;
GRANT ALL ON public.buyer_orders TO service_role;
ALTER TABLE public.buyer_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer sees own orders" ON public.buyer_orders
  FOR SELECT TO authenticated USING (
    buyer_id IN (SELECT id FROM public.wholesale_buyers WHERE user_id = auth.uid())
    OR pharmacy_id = public.current_pharmacy_id()
    OR public.is_director(auth.uid())
  );
CREATE POLICY "buyer creates own orders" ON public.buyer_orders
  FOR INSERT TO authenticated WITH CHECK (
    buyer_id IN (SELECT id FROM public.wholesale_buyers WHERE user_id = auth.uid())
  );
CREATE POLICY "staff updates orders" ON public.buyer_orders
  FOR UPDATE TO authenticated USING (
    pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid())
  );
CREATE POLICY "staff deletes orders" ON public.buyer_orders
  FOR DELETE TO authenticated USING (
    pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid())
  );

-- 4) buyer_order_items
CREATE TABLE IF NOT EXISTS public.buyer_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.buyer_orders(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  drug_id uuid REFERENCES public.drugs(id) ON DELETE SET NULL,
  drug_name text NOT NULL,
  requested_qty integer NOT NULL,
  approved_qty integer,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reject_reason text,
  flagged_out_of_stock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_order_items TO authenticated;
GRANT ALL ON public.buyer_order_items TO service_role;
ALTER TABLE public.buyer_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer reads own order items" ON public.buyer_order_items
  FOR SELECT TO authenticated USING (
    order_id IN (
      SELECT o.id FROM public.buyer_orders o
      JOIN public.wholesale_buyers b ON b.id = o.buyer_id
      WHERE b.user_id = auth.uid()
    )
    OR pharmacy_id = public.current_pharmacy_id()
    OR public.is_director(auth.uid())
  );
CREATE POLICY "buyer inserts own order items" ON public.buyer_order_items
  FOR INSERT TO authenticated WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.buyer_orders o
      JOIN public.wholesale_buyers b ON b.id = o.buyer_id
      WHERE b.user_id = auth.uid()
    )
  );
CREATE POLICY "staff updates order items" ON public.buyer_order_items
  FOR UPDATE TO authenticated USING (
    pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid())
  );
CREATE POLICY "staff deletes order items" ON public.buyer_order_items
  FOR DELETE TO authenticated USING (
    pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid())
  );

-- 5) Accountant reports edit window (5h) and pharmacy scoping for select
-- Drop existing UPDATE policies, then recreate with time limit.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='accountant_reports' LOOP
    EXECUTE format('DROP POLICY %I ON public.accountant_reports', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "ar select" ON public.accountant_reports
  FOR SELECT TO authenticated USING (
    pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid())
  );
CREATE POLICY "ar insert own" ON public.accountant_reports
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()))
  );
CREATE POLICY "ar update within 5h" ON public.accountant_reports
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() AND created_at > now() - interval '5 hours'
  ) WITH CHECK (
    created_by = auth.uid() AND created_at > now() - interval '5 hours'
  );
CREATE POLICY "ar delete own within 5h" ON public.accountant_reports
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() AND created_at > now() - interval '5 hours'
  );

-- 6) updated_at trigger helper for new tables
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS wb_touch ON public.wholesale_buyers;
CREATE TRIGGER wb_touch BEFORE UPDATE ON public.wholesale_buyers
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS bo_touch ON public.buyer_orders;
CREATE TRIGGER bo_touch BEFORE UPDATE ON public.buyer_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
