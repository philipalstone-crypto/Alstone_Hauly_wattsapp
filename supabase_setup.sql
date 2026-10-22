-- Run this in Supabase Dashboard > SQL Editor.
-- Phone authentication must be enabled in Authentication > Providers > Phone.
-- Configure an SMS provider before real OTP login.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- Each user can see their own profile; signed-in users can look up profiles
-- by phone for app contacts. Consider stricter contact discovery for production.
create policy "Signed-in users can read profiles"
on public.profiles for select to authenticated using (true);

create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "Participants can read their messages"
on public.messages for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "Sender can send messages as themselves"
on public.messages for insert to authenticated
with check (sender_id = auth.uid());

-- Create a profile automatically when a phone-auth user is created.
create or replace function public.handle_new_phone_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is not null then
    insert into public.profiles (id, phone)
    values (new.id, new.phone)
    on conflict (id) do update set phone = excluded.phone;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert or update of phone on auth.users
for each row execute procedure public.handle_new_phone_user();

-- Enable realtime updates for messages (ignore error if already added).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
