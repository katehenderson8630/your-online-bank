
-- 1) Remove the user-side INSERT policy on cards. Card creation goes through admin-action only (service role bypasses RLS).
DROP POLICY IF EXISTS "users insert own cards" ON public.cards;

-- 2) Block users from updating admin-controlled profile fields (kyc_status, kyc_reason, ssn).
CREATE OR REPLACE FUNCTION public.guard_profile_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role / admins to do anything
  IF private.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin update path: lock down sensitive fields
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    NEW.kyc_status := OLD.kyc_status;
  END IF;
  IF NEW.kyc_reason IS DISTINCT FROM OLD.kyc_reason THEN
    NEW.kyc_reason := OLD.kyc_reason;
  END IF;
  IF NEW.ssn IS DISTINCT FROM OLD.ssn THEN
    NEW.ssn := OLD.ssn;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_user_update ON public.profiles;
CREATE TRIGGER profiles_guard_user_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_user_update();
