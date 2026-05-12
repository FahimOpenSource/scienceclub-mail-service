create or replace function public.get_class_stream_user_emails(
  class_name text,
  stream_name text
)

returns table (
  class_stream_exists boolean,
  emails jsonb
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  found_class_stream_id integer;
begin
  select class_streams.id
  into found_class_stream_id
  from public.class_streams
  join public.classes
    on classes.id = class_streams.class_id
  join public.streams
    on streams.id = class_streams.stream_id
  where lower(classes.name) = lower(trim(class_name))
    and lower(streams.name) = lower(trim(stream_name))
  limit 1;

  if found_class_stream_id is null then
    return query
    select false, '{}'::jsonb;
    return;
  end if;

  return query
  select
    true,
    coalesce(
      jsonb_object_agg(lower(users.email), users.id  order by lower(users.email))
        filter (where users.email is not null), '{}'::jsonb
    )
  from public.profiles
  join auth.users
    on users.id = profiles.id
  where profiles.class_stream_id = found_class_stream_id
    and profiles.status = 'active';
end;
$$;

revoke all on function public.get_class_stream_user_emails(text, text) from public;
revoke all on function public.get_class_stream_user_emails(text, text) from anon;
revoke all on function public.get_class_stream_user_emails(text, text) from authenticated;
grant execute on function public.get_class_stream_user_emails(text, text) to service_role;
