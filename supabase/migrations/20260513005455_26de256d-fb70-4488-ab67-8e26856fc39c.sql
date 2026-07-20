CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

ALTER POLICY "admins manage accounts" ON public.accounts
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "users view own accounts" ON public.accounts
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins insert audit" ON public.admin_audit_log
  WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "admins view audit" ON public.admin_audit_log
  USING (private.is_admin(auth.uid()));

ALTER POLICY "admins update atc" ON public.atc_requests
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own atc" ON public.atc_requests
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins view bp" ON public.bill_payments
  USING (private.is_admin(auth.uid()));

ALTER POLICY "admins update card req" ON public.card_requests
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own card req" ON public.card_requests
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "users delete own cards" ON public.cards
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));
ALTER POLICY "users update own cards" ON public.cards
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));
ALTER POLICY "users view own cards" ON public.cards
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins update dr" ON public.deposit_requests
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own dr" ON public.deposit_requests
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins update loans" ON public.loan_requests
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own loans" ON public.loan_requests
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins view payees" ON public.payees
  USING (private.is_admin(auth.uid()));

ALTER POLICY "admins update any profile" ON public.profiles
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own profile" ON public.profiles
  USING ((auth.uid() = id) OR private.is_admin(auth.uid()));

ALTER POLICY "users update own conversations" ON public.support_conversations
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));
ALTER POLICY "users view own conversations" ON public.support_conversations
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "users insert own messages" ON public.support_messages
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND ((c.user_id = auth.uid()) OR private.is_admin(auth.uid()))
  ));
ALTER POLICY "users view own messages" ON public.support_messages
  USING (EXISTS (
    SELECT 1
    FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND ((c.user_id = auth.uid()) OR private.is_admin(auth.uid()))
  ));

ALTER POLICY "admins insert tx" ON public.transactions
  WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "users view own tx" ON public.transactions
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins update tr" ON public.transfer_requests
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own tr" ON public.transfer_requests
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins manage roles" ON public.user_roles
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
ALTER POLICY "users view own roles" ON public.user_roles
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));

ALTER POLICY "admins update wr" ON public.withdrawal_requests
  USING (private.is_admin(auth.uid()));
ALTER POLICY "users view own wr" ON public.withdrawal_requests
  USING ((auth.uid() = user_id) OR private.is_admin(auth.uid()));