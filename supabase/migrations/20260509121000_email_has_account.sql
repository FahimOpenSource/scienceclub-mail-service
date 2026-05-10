drop function if exists public.email_has_account(text);

create function public.email_has_account(email_address text)
returns table (
  has_account boolean,
  user_id uuid,
  is_confirmed boolean,
  has_profile boolean
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    users.id is not null as has_account,
    users.id as user_id,
    users.email_confirmed_at is not null as is_confirmed,
    profiles.id is not null as has_profile
  from (select lower(trim(email_address)) as normalized_email) input
  left join auth.users
    on lower(users.email) = input.normalized_email
  left join public.profiles
    on profiles.id = users.id
  limit 1
$$;

revoke all on function public.email_has_account(text) from public;
revoke all on function public.email_has_account(text) from anon;
revoke all on function public.email_has_account(text) from authenticated;
grant execute on function public.email_has_account(text) to service_role;
