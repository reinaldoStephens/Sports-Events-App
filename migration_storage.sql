-- We assume RLS is already enabled on storage.objects (standard in Supabase).
-- We skip 'ALTER TABLE' to avoid permission errors.

-- 1. Create Bucket if not exists (Idempotent)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policies for this bucket to avoid conflicts
-- We use DO blocks to avoid errors if they don't exist
drop policy if exists "Public Access to Logos" on storage.objects;
drop policy if exists "Authenticated Users can Upload Logos" on storage.objects;
drop policy if exists "Authenticated Users can Update Logos" on storage.objects;
-- Also drop any policies that might match the generic "Give users..." pattern if you want to clean up, 
-- but it's safer to just add ours.

-- 3. Create Specific Policies for 'logos' bucket

-- ALLOW PUBLIC SELECT (View images)
create policy "Public Access to Logos"
  on storage.objects for select
  using ( bucket_id = 'logos' );

-- ALLOW AUTHENTICATED INSERT (Upload)
create policy "Authenticated Users can Upload Logos"
  on storage.objects for insert
  with check ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- ALLOW AUTHENTICATED UPDATE (Replace image)
create policy "Authenticated Users can Update Logos"
  on storage.objects for update
  using ( bucket_id = 'logos' AND auth.role() = 'authenticated' );

-- Note: DELETE is optional, usually we don't need it for this feature yet (we just replace).
