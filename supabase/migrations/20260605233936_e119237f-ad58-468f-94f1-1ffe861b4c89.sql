
CREATE TABLE public.login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email_idx ON public.login_codes (email, created_at DESC);

GRANT ALL ON public.login_codes TO service_role;
ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) accesses this table.
