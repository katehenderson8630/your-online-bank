
-- Grant admin role to musasule863@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('da2f6e99-1c2d-4cdf-b788-93e22f9c4307', 'admin')
ON CONFLICT DO NOTHING;

-- Replace last-4 SSN with full SSN field on profiles (encrypted-at-rest by Postgres; only the user + admins can read via existing RLS)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ssn TEXT;

-- ATC (Authorization Transfer Code) requests: required to authorize each transfer/payment
CREATE TABLE IF NOT EXISTS public.atc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  code TEXT,
  used BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.atc_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own atc" ON public.atc_requests
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "users create own atc" ON public.atc_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update atc" ON public.atc_requests
  FOR UPDATE USING (is_admin(auth.uid()));
