-- Diagnostic script part 2 (FIXED)
-- Check jornada_id of the matches

SELECT 
    p.id, 
    el.nombre as local, 
    ev.nombre as visitante, 
    p.estado_partido,
    p.jornada_id,
    j.numero_jornada
FROM partidos p
LEFT JOIN jornadas j ON p.jornada_id = j.id
LEFT JOIN equipos el ON p.equipo_local_id = el.id
LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
WHERE p.torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
AND p.ronda IS NULL;
