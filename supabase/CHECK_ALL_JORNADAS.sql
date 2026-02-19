-- Quick check: Show all jornadas for troubleshooting
SELECT 
    j.id,
    j.torneo_id,
    t.nombre as torneo_nombre,
    j.numero_jornada,
    j.nombre_fase,
    j.creado_at
FROM jornadas j
LEFT JOIN torneos t ON t.id = j.torneo_id
ORDER BY j.torneo_id, j.numero_jornada;
