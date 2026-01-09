-- Create tables
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('admin', 'user')) default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  date timestamp with time zone not null,
  location text not null,
  image_url text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.registrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  event_id uuid references public.events(id) not null,
  registration_date timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, event_id)
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Policies for Events
create policy "Events are viewable by everyone." on public.events
  for select using (true);

create policy "Admins can insert events." on public.events
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update events." on public.events
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies for Registrations
create policy "Users can view their own registrations." on public.registrations
  for select using (auth.uid() = user_id);

create policy "Admins can view all registrations." on public.registrations
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can register themselves." on public.registrations
  for insert with check (auth.uid() = user_id);

-- Storage bucket setup (if not exists via UI, but SQL can do it)
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "Public Access to Event Images" on storage.objects
  for select using ( bucket_id = 'event-images' );

create policy "Admins can upload Event Images" on storage.objects
  for insert with check (
    bucket_id = 'event-images' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
