-- Check for 'goles' table and drop if exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'goles';

-- Drop table if exists (run this manually if the above returns 'goles')
-- DROP TABLE IF EXISTS public.goles;
