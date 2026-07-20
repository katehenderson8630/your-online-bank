
-- Create loan request status using existing request_status type

CREATE TABLE public.loan_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  purpose text,
  duration_months integer NOT NULL DEFAULT 12,
  status request_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own loans" ON public.loan_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users view own loans" ON public.loan_requests FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "admins update loans" ON public.loan_requests FOR UPDATE USING (is_admin(auth.uid()));
