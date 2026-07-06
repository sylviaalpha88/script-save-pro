
CREATE TABLE IF NOT EXISTS public.sms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'africastalking',
  at_username text,
  at_api_key text,
  sender_id text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_settings TO authenticated;
GRANT ALL ON public.sms_settings TO service_role;
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "director reads sms_settings" ON public.sms_settings FOR SELECT TO authenticated USING (is_director(auth.uid()));
CREATE POLICY "director writes sms_settings" ON public.sms_settings FOR INSERT TO authenticated WITH CHECK (is_director(auth.uid()));
CREATE POLICY "director updates sms_settings" ON public.sms_settings FOR UPDATE TO authenticated USING (is_director(auth.uid())) WITH CHECK (is_director(auth.uid()));
CREATE POLICY "director deletes sms_settings" ON public.sms_settings FOR DELETE TO authenticated USING (is_director(auth.uid()));
CREATE TRIGGER tg_sms_settings_updated_at BEFORE UPDATE ON public.sms_settings FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  sender_id uuid,
  buyer_id uuid,
  recipient_name text,
  recipient_phone text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read messages" ON public.messages FOR SELECT TO authenticated
  USING (pharmacy_id = current_pharmacy_id() OR is_director(auth.uid()));
CREATE POLICY "staff insert messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (pharmacy_id = current_pharmacy_id() OR is_director(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_messages_pharmacy_created ON public.messages(pharmacy_id, created_at DESC);
