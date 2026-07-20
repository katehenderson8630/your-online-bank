
-- 1) Auto-create accounts on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _acct_chk text;
  _acct_sav text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create checking & savings accounts immediately, so new users see an account number
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = NEW.id) THEN
    _acct_chk := '100' || lpad(floor(random()*1e7)::bigint::text, 7, '0');
    _acct_sav := '200' || lpad(floor(random()*1e7)::bigint::text, 7, '0');
    INSERT INTO public.accounts (user_id, account_type, account_number) VALUES
      (NEW.id, 'checking', _acct_chk),
      (NEW.id, 'savings', _acct_sav);
  END IF;

  RETURN NEW;
END;
$$;

-- Make sure the trigger is in place
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: give every existing user without accounts a checking + savings
INSERT INTO public.accounts (user_id, account_type, account_number)
SELECT u.id, 'checking', '100' || lpad(floor(random()*1e7)::bigint::text, 7, '0')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.user_id = u.id AND a.account_type = 'checking');

INSERT INTO public.accounts (user_id, account_type, account_number)
SELECT u.id, 'savings', '200' || lpad(floor(random()*1e7)::bigint::text, 7, '0')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.user_id = u.id AND a.account_type = 'savings');

-- 2) Avatars bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Avatar policies (drop-and-create for idempotency)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars user upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars user update" ON storage.objects;
DROP POLICY IF EXISTS "avatars user delete" ON storage.objects;

CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars user upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars user update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars user delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3) Realtime channel-level RLS — restrict topic subscriptions to the user's own UUID topic
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users subscribe own topic" ON realtime.messages;
CREATE POLICY "users subscribe own topic"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- Allow only topics that contain this user's UUID (e.g. dash-<uid>, atc-<uid>, support-<uid>)
    realtime.topic() LIKE '%' || auth.uid()::text || '%'
  );

DROP POLICY IF EXISTS "users send to own topic" ON realtime.messages;
CREATE POLICY "users send to own topic"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE '%' || auth.uid()::text || '%'
  );
