
-- Replace broad public SELECT with a per-user listing policy.
-- The bucket is public so direct image URLs still work via the storage CDN.
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;

CREATE POLICY "avatars user list own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
