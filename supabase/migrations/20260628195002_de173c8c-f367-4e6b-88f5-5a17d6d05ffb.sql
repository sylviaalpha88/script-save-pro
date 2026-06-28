
-- 1) Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'order_track';

-- 2) Pharmacy profile fields
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS logo_path text;

-- Allow pharmacy admin to update own pharmacy row (director already manages all via existing FOR ALL policy)
DROP POLICY IF EXISTS "Admin updates own pharmacy" ON public.pharmacies;
CREATE POLICY "Admin updates own pharmacy" ON public.pharmacies
  FOR UPDATE TO authenticated
  USING (id = public.current_pharmacy_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.current_pharmacy_id() AND public.has_role(auth.uid(), 'admin'));

-- 3) order_tracking_events table
CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.buyer_orders(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location_name text,
  latitude double precision,
  longitude double precision,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_tracking_events TO authenticated;
GRANT ALL ON public.order_tracking_events TO service_role;
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

-- Pharmacy staff (admin/pharmacy/order_track) can read/insert events for own pharmacy
DROP POLICY IF EXISTS "Staff manage tracking events" ON public.order_tracking_events;
CREATE POLICY "Staff manage tracking events" ON public.order_tracking_events
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id())
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

-- Buyers can view events for their own orders
DROP POLICY IF EXISTS "Buyer reads own tracking" ON public.order_tracking_events;
CREATE POLICY "Buyer reads own tracking" ON public.order_tracking_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_orders o
      JOIN public.wholesale_buyers b ON b.id = o.buyer_id
      WHERE o.id = order_tracking_events.order_id AND b.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS order_tracking_events_order_idx ON public.order_tracking_events(order_id, created_at DESC);

-- 4) Storage policies for pharmacy-logos bucket
DROP POLICY IF EXISTS "Pharmacy logos readable by auth" ON storage.objects;
CREATE POLICY "Pharmacy logos readable by auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pharmacy-logos');

DROP POLICY IF EXISTS "Pharmacy admin uploads logo" ON storage.objects;
CREATE POLICY "Pharmacy admin uploads logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pharmacy-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pharmacy admin updates logo" ON storage.objects;
CREATE POLICY "Pharmacy admin updates logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pharmacy-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pharmacy admin deletes logo" ON storage.objects;
CREATE POLICY "Pharmacy admin deletes logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pharmacy-logos' AND public.has_role(auth.uid(), 'admin'));
