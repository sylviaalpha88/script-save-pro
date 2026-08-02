CREATE POLICY "Applicants can upload application files"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'applications');

CREATE POLICY "Signed in can upload application files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'applications');

CREATE POLICY "Staff can read application files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'applications');