-- Modify registrations table to support guests
-- 1. Remove user_id if it still exists (User said they deleted it, but good to be safe with IF EXISTS)
alter table public.registrations drop column if exists user_id;

-- 2. Add name and email columns
alter table public.registrations add column if not exists name text;
alter table public.registrations add column if not exists email text;

-- 3. Remove the old unique constraint (which was on user_id, event_id)
alter table public.registrations drop constraint if exists registrations_user_id_event_id_key;

-- 4. Add a new unique constraint on (email, event_id) to prevent duplicate signups
alter table public.registrations add constraint registrations_email_event_id_unique unique (email, event_id);

-- 5. Update RLS Policies
-- Since we are using Service Role for insertions in the Action, strict RLS for 'anon' isn't blocking,
-- but we should ensure the table is explicitly secure or open as intended.
-- For now, let's allow Admins to see everything.
drop policy if exists "Users can view their own registrations." on public.registrations;
drop policy if exists "Users can register themselves." on public.registrations;

create policy "Admins can view and edit all registrations." on public.registrations
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Allow public inserts? 
-- If we only insert via Server Action with Service Role, we don't strictly need a public INSERT policy.
-- But if client-side code tried to insert, it would need:
-- create policy "Public can register." on public.registrations for insert with check (true);
