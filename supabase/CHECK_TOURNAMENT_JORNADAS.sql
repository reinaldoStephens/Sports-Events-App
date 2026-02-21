-- Check all jornadas for the specific tournament
-- Replace with your actual tournament ID
SELECT 
    j.id,
    j.numero_jornada,
    j.nombre_fase,
    j.creado_at
FROM jornadas j
WHERE j.torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
ORDER BY j.numero_jornada;
