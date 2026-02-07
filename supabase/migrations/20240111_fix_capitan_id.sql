-- Fix missing columns in equipos table
ALTER TABLE public.equipos ADD COLUMN IF NOT EXISTS capitan_id uuid;
ALTER TABLE public.equipos ADD COLUMN IF NOT EXISTS escudo_url text;
