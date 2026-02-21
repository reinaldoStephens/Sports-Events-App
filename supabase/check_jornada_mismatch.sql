-- Check if matches have different jornada_id than current jornadas

-- 1. Current Jornadas for this tournament
select id, numero_jornada, nombre_fase 
from jornadas 
where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- 2. Matches and their jornada_id
select id, jornada_id, equipo_local_id, equipo_visitante_id 
from partidos 
where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- 3. Check if any matches point to non-existent jornadas (ORPHANS)
select 
    p.id as partido_id,
    p.jornada_id as partido_jornada_id,
    j.id as jornada_exists
from partidos p
left join jornadas j on p.jornada_id = j.id
where p.torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';
