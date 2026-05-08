create extension if not exists pgcrypto;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.streams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (class_id, name),
  unique (id, class_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  class_id uuid not null references public.classes(id) on delete restrict,
  stream_id uuid not null,
  boarding boolean not null default false,
  role text not null default 'student'
    check (role in ('student', 'teacher', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  foreign key (stream_id, class_id) references public.streams(id, class_id) on delete restrict
);

create table public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_email text not null unique,
  assigned_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint email_aliases_alias_email_lowercase
    check (alias_email = lower(alias_email)),
  constraint email_aliases_alias_email_format
    check (alias_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  to_alias text not null references public.email_aliases(alias_email) on update cascade on delete restrict,
  assigned_user_id uuid not null references public.profiles(id) on delete restrict,
  from_email text,
  from_name text,
  subject text,
  snippet text,
  received_at timestamptz not null,
  has_attachments boolean not null default false,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index streams_class_id_idx
  on public.streams (class_id);

create index profiles_class_id_idx
  on public.profiles (class_id);

create index profiles_stream_id_idx
  on public.profiles (stream_id);

create index email_aliases_assigned_user_id_idx
  on public.email_aliases (assigned_user_id);

create index email_messages_assigned_user_id_idx
  on public.email_messages (assigned_user_id);

create index email_messages_to_alias_idx
  on public.email_messages (to_alias);

create index email_messages_received_at_idx
  on public.email_messages (received_at desc);

alter table public.classes enable row level security;
alter table public.streams enable row level security;
alter table public.profiles enable row level security;
alter table public.email_aliases enable row level security;
alter table public.email_messages enable row level security;

create policy "Authenticated users can view classes"
  on public.classes
  for select
  to authenticated
  using (true);

create policy "Authenticated users can view streams"
  on public.streams
  for select
  to authenticated
  using (true);

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own profile name"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users can view their assigned aliases"
  on public.email_aliases
  for select
  to authenticated
  using (assigned_user_id = auth.uid());

create policy "Users can view their assigned messages"
  on public.email_messages
  for select
  to authenticated
  using (assigned_user_id = auth.uid());

create policy "Users can update read state on their assigned messages"
  on public.email_messages
  for update
  to authenticated
  using (assigned_user_id = auth.uid())
  with check (assigned_user_id = auth.uid());

revoke all on public.classes from anon, authenticated;
revoke all on public.streams from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.email_aliases from anon, authenticated;
revoke all on public.email_messages from anon, authenticated;

grant select on public.classes to authenticated;
grant select on public.streams to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, class_id, stream_id, boarding) on public.profiles to authenticated;

grant select on public.email_aliases to authenticated;

grant select on public.email_messages to authenticated;
grant update (is_read) on public.email_messages to authenticated;

grant all on public.classes to service_role;
grant all on public.streams to service_role;
grant all on public.profiles to service_role;
grant all on public.email_aliases to service_role;
grant all on public.email_messages to service_role;
