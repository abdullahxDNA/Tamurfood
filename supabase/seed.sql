-- Create menu-images storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read only.
-- Uploads are proxied through the Hono server using the service role key,
-- so no anon upload/update policy is needed here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'menu-images public select'
  ) THEN
    EXECUTE 'CREATE POLICY "menu-images public select"
      ON storage.objects FOR SELECT TO anon
      USING (bucket_id = ''menu-images'')';
  END IF;

  -- Remove overly-permissive anon upload/update policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'menu-images anon upload'
  ) THEN
    EXECUTE 'DROP POLICY "menu-images anon upload" ON storage.objects';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'menu-images anon update'
  ) THEN
    EXECUTE 'DROP POLICY "menu-images anon update" ON storage.objects';
  END IF;
END $$;
