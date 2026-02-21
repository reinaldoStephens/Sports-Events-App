-- CHECK 1: Count of matches and jornadas for the tournament
select 
    (select count(*) from partidos where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b') as total_partidos,
    (select count(*) from jornadas where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b') as total_jornadas;

-- CHECK 2: List Matches with their Jornada Info
select 
    p.id as partido_id, 
    p.estado_partido,
    p.equipo_local_id,
    p.equipo_visitante_id,
    p.jornada_id as partido_jornada_id, 
    j.id as jornada_real_id,
    j.numero_jornada,
    j.nombre_fase
from partidos p
left join jornadas j on p.jornada_id = j.id
where p.torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- CHECK 3: Check if teams exist
select id, nombre from equipos where id in (
    select equipo_local_id from partidos where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
    union
    select equipo_visitante_id from partidos where torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
);
