-- HARD RESET for Tournament: c16862f2-9689-4871-bc94-ad206ec9dd8b
-- This will delete ALL data for this tournament to allow a clean start.

-- 1. Delete events (if any)
delete from eventos_partido 
where partido_id in (select id from partidos where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b');

-- 2. Delete matches (including orphans)
delete from partidos 
where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- 3. Delete jornadas
delete from jornadas 
where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- 4. Reset tournament status to allow generation
update torneos 
set estado = 'pendiente' 
where id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- 5. Show result
select 'Cleanup Complete' as status;
