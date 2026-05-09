create or replace function public.email_has_account(email_address text)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where lower(users.email) = lower(trim(email_address))
  )
$$;

revoke all on function public.email_has_account(text) from public;
revoke all on function public.email_has_account(text) from anon;
revoke all on function public.email_has_account(text) from authenticated;
grant execute on function public.email_has_account(text) to service_role;
