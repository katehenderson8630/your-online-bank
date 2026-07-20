-- Ensure approved ATC codes are unique and account-bound
ALTER TABLE public.atc_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_by_transfer_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS atc_requests_unique_code_idx
  ON public.atc_requests (code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS atc_requests_account_status_idx
  ON public.atc_requests (account_id, status, used, created_at DESC);

-- Let transfer requests record which ATC code authorized them
ALTER TABLE public.transfer_requests
  ADD COLUMN IF NOT EXISTS atc_request_id UUID;

CREATE INDEX IF NOT EXISTS transfer_requests_atc_request_id_idx
  ON public.transfer_requests (atc_request_id);

-- Keep support conversations fresh and track who should be notified
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_message_role public.support_role,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS unread_for_user BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unread_for_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.touch_support_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_conversations
  SET
    updated_at = now(),
    last_message_at = now(),
    last_message_role = NEW.role,
    unread_for_user = CASE WHEN NEW.role = 'agent' THEN true ELSE unread_for_user END,
    unread_for_admin = CASE WHEN NEW.role = 'user' THEN true ELSE unread_for_admin END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_message_touch_conversation ON public.support_messages;
CREATE TRIGGER trg_support_message_touch_conversation
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_support_conversation_on_message();

-- Ensure app status reloads after admin updates
CREATE INDEX IF NOT EXISTS profiles_kyc_status_idx ON public.profiles (kyc_status);
CREATE INDEX IF NOT EXISTS card_requests_user_status_idx ON public.card_requests (user_id, status, created_at DESC);