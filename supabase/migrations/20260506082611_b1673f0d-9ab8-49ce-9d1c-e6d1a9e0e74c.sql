
alter function public.handle_new_user() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.gen_account_number() set search_path = public;

revoke execute on function public.post_transaction(uuid,public.tx_type,numeric,text,text,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.execute_internal_transfer(uuid,uuid,numeric,text) from public, anon, authenticated;
revoke execute on function public.has_role(uuid,public.app_role) from anon;
revoke execute on function public.is_admin(uuid) from anon;
