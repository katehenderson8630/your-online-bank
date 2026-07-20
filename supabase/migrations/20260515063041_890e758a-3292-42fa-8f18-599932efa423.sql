CREATE OR REPLACE FUNCTION public.guard_profile_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role (auth.uid() is null) and admins to do anything
  IF auth.uid() IS NULL OR private.is_admin(auth.uid()) THEN
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
$function$;