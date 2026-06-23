
-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'pharmacy', 'inventory');
CREATE TYPE public.sale_type AS ENUM ('retail', 'wholesale');
CREATE TYPE public.drug_unit AS ENUM ('tab', 'cap', 'piece');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drugs / Inventory
CREATE TABLE public.drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit drug_unit NOT NULL DEFAULT 'tab',
  buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drugs TO authenticated;
GRANT ALL ON public.drugs TO service_role;
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed read drugs" ON public.drugs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inventory/admin write drugs" ON public.drugs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pharmacy'))
  WITH CHECK (public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pharmacy'));

-- Patients (retail)
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER,
  patient_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed manage patients" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_type sale_type NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  customer_name TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authed create sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);

-- Sale Items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES public.drugs(id),
  drug_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed read sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authed insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: decrement stock on sale_item insert
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.drugs SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
  WHERE id = NEW.drug_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sale_item_decrement
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale();
