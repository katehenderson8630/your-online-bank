-- Card request workflow
CREATE TABLE public.card_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 465,
  status request_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.card_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own card req" ON public.card_requests
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users view own card req" ON public.card_requests
FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "admins update card req" ON public.card_requests
FOR UPDATE USING (is_admin(auth.uid()));