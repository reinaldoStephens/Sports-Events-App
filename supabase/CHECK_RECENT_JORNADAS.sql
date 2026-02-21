-- Check jornadas created in the last 5 minutes
SELECT 
    j.id,
    j.torneo_id,
    t.nombre as torneo_nombre,
    j.numero_jornada,
    j.nombre_fase,
    j.creado_at,
    NOW() - j.creado_at as tiempo_desde_creacion
FROM jornadas j
LEFT JOIN torneos t ON t.id = j.torneo_id
WHERE j.creado_at > NOW() - INTERVAL '5 minutes'
ORDER BY j.creado_at DESC;
