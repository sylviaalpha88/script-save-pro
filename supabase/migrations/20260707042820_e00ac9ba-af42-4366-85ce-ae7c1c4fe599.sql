
ALTER TABLE public.sms_settings ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_settings_pharmacy ON public.sms_settings(pharmacy_id) WHERE pharmacy_id IS NOT NULL;

DROP POLICY IF EXISTS "director reads sms_settings" ON public.sms_settings;
DROP POLICY IF EXISTS "director writes sms_settings" ON public.sms_settings;
DROP POLICY IF EXISTS "director updates sms_settings" ON public.sms_settings;
DROP POLICY IF EXISTS "director deletes sms_settings" ON public.sms_settings;

CREATE POLICY "read sms_settings" ON public.sms_settings FOR SELECT TO authenticated
  USING (
    is_director(auth.uid())
    OR (pharmacy_id IS NOT NULL AND pharmacy_id = current_pharmacy_id() AND current_role_name() = 'admin')
  );
CREATE POLICY "insert sms_settings" ON public.sms_settings FOR INSERT TO authenticated
  WITH CHECK (
    is_director(auth.uid())
    OR (pharmacy_id IS NOT NULL AND pharmacy_id = current_pharmacy_id() AND current_role_name() = 'admin')
  );
CREATE POLICY "update sms_settings" ON public.sms_settings FOR UPDATE TO authenticated
  USING (
    is_director(auth.uid())
    OR (pharmacy_id IS NOT NULL AND pharmacy_id = current_pharmacy_id() AND current_role_name() = 'admin')
  )
  WITH CHECK (
    is_director(auth.uid())
    OR (pharmacy_id IS NOT NULL AND pharmacy_id = current_pharmacy_id() AND current_role_name() = 'admin')
  );
CREATE POLICY "delete sms_settings" ON public.sms_settings FOR DELETE TO authenticated
  USING (
    is_director(auth.uid())
    OR (pharmacy_id IS NOT NULL AND pharmacy_id = current_pharmacy_id() AND current_role_name() = 'admin')
  );
