
CREATE POLICY "licenses upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'licenses' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "licenses read own or staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'licenses' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','pharmacy','inventory','accountant'))
    )
  );

CREATE POLICY "licenses delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'licenses' AND (storage.foldername(name))[1] = auth.uid()::text);
