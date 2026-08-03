-- 1. Pharmacy counter stock
CREATE TABLE public.pharmacy_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  drug_id uuid NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, drug_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_stock TO authenticated;
GRANT ALL ON public.pharmacy_stock TO service_role;
ALTER TABLE public.pharmacy_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharmacy_stock same pharmacy" ON public.pharmacy_stock
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()))
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());
CREATE TRIGGER ps_touch BEFORE UPDATE ON public.pharmacy_stock
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2. Stock orders (pharmacy -> procurement)
CREATE TABLE public.stock_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  note text,
  requested_by uuid,
  requested_by_name text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_orders TO authenticated;
GRANT ALL ON public.stock_orders TO service_role;
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_orders same pharmacy" ON public.stock_orders
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()))
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());
CREATE TRIGGER so_touch BEFORE UPDATE ON public.stock_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.stock_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.stock_orders(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  drug_id uuid NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  drug_name text NOT NULL,
  quantity integer NOT NULL,
  approved_qty integer,
  status text NOT NULL DEFAULT 'pending',
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_order_items TO authenticated;
GRANT ALL ON public.stock_order_items TO service_role;
ALTER TABLE public.stock_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_order_items same pharmacy" ON public.stock_order_items
  FOR ALL TO authenticated
  USING (pharmacy_id = public.current_pharmacy_id() OR public.is_director(auth.uid()))
  WITH CHECK (pharmacy_id = public.current_pharmacy_id());

-- 3. Approve a stock order: move quantities from procurement store into pharmacy store
CREATE OR REPLACE FUNCTION public.approve_stock_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.stock_orders;
  it public.stock_order_items;
  qty integer;
  avail integer;
BEGIN
  SELECT * INTO ord FROM public.stock_orders WHERE id = _order_id;
  IF ord IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF ord.pharmacy_id <> public.current_pharmacy_id() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF ord.status = 'approved' THEN RAISE EXCEPTION 'Order already approved'; END IF;

  FOR it IN SELECT * FROM public.stock_order_items WHERE order_id = _order_id LOOP
    qty := COALESCE(it.approved_qty, it.quantity);
    IF it.status = 'rejected' OR qty <= 0 THEN CONTINUE; END IF;

    SELECT stock_quantity INTO avail FROM public.drugs WHERE id = it.drug_id FOR UPDATE;
    IF avail IS NULL OR avail < qty THEN
      RAISE EXCEPTION 'Procurement store has only % of %', COALESCE(avail, 0), it.drug_name;
    END IF;

    UPDATE public.drugs SET stock_quantity = stock_quantity - qty, updated_at = now()
      WHERE id = it.drug_id;

    INSERT INTO public.pharmacy_stock (pharmacy_id, drug_id, quantity)
      VALUES (ord.pharmacy_id, it.drug_id, qty)
      ON CONFLICT (pharmacy_id, drug_id)
      DO UPDATE SET quantity = public.pharmacy_stock.quantity + qty, updated_at = now();

    UPDATE public.stock_order_items
      SET status = 'approved', approved_qty = qty WHERE id = it.id;
  END LOOP;

  UPDATE public.stock_orders
    SET status = 'approved', decided_by = auth.uid(), decided_at = now()
    WHERE id = _order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_stock_order(uuid) TO authenticated;

-- 4. Sales now draw down the pharmacy store instead of the procurement store
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ph uuid;
  have integer;
BEGIN
  SELECT pharmacy_id INTO ph FROM public.sales WHERE id = NEW.sale_id;
  IF ph IS NULL THEN
    ph := NEW.pharmacy_id;
  END IF;

  SELECT quantity INTO have FROM public.pharmacy_stock
    WHERE pharmacy_id = ph AND drug_id = NEW.drug_id FOR UPDATE;

  IF have IS NULL THEN
    RAISE EXCEPTION '% is not in the pharmacy store. Make an order at Procurement first.', NEW.drug_name;
  END IF;
  IF have < NEW.quantity THEN
    RAISE EXCEPTION 'Pharmacy store holds only % of %. Make an order at Procurement first.', have, NEW.drug_name;
  END IF;

  UPDATE public.pharmacy_stock
    SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE pharmacy_id = ph AND drug_id = NEW.drug_id;

  RETURN NEW;
END;
$$;