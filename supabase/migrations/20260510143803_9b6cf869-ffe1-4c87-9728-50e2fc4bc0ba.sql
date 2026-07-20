REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_support_conversation_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_transaction(uuid, public.tx_type, numeric, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_internal_transfer(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_transaction(uuid, public.tx_type, numeric, text, text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_internal_transfer(uuid, uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_support_conversation_on_message() TO service_role;