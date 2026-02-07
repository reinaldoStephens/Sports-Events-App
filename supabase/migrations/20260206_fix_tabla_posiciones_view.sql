-- Fix tabla_posiciones_view to use puntos_* instead of goles_*
-- Date: 2026-02-06

-- Drop and recreate the view with correct column names
DROP VIEW IF EXISTS tabla_posiciones_view;

CREATE OR REPLACE VIEW tabla_posiciones_view AS
WITH partido_stats AS (
    SELECT 
        p.id as partido_id,
        p.equipo_local_id,
        p.equipo_visitante_id,
        p.puntos_local,
        p.puntos_visitante,
        j.torneo_id,
        CASE 
            WHEN p.puntos_local > p.puntos_visitante THEN p.equipo_local_id
            WHEN p.puntos_visitante > p.puntos_local THEN p.equipo_visitante_id
            ELSE NULL
        END as ganador_id
    FROM public.partidos p
    JOIN public.jornadas j ON p.jornada_id = j.id
    WHERE p.estado_partido = 'finalizado'
    AND p.equipo_local_id IS NOT NULL
    AND p.equipo_visitante_id IS NOT NULL
),
equipo_stats AS (
    -- Stats for local team
    SELECT 
        ps.torneo_id,
        ps.equipo_local_id as equipo_id,
        COUNT(*) as pj,
        SUM(CASE WHEN ps.ganador_id = ps.equipo_local_id THEN 1 ELSE 0 END) as g,
        SUM(CASE WHEN ps.ganador_id IS NULL THEN 1 ELSE 0 END) as e,
        SUM(CASE WHEN ps.ganador_id = ps.equipo_visitante_id THEN 1 ELSE 0 END) as p,
        SUM(ps.puntos_local) as gf,
        SUM(ps.puntos_visitante) as gc,
        SUM(CASE 
            WHEN ps.ganador_id = ps.equipo_local_id THEN 3
            WHEN ps.ganador_id IS NULL THEN 1
            ELSE 0
        END) as pts
    FROM partido_stats ps
    GROUP BY ps.torneo_id, ps.equipo_local_id

    UNION ALL

    -- Stats for visiting team
    SELECT 
        ps.torneo_id,
        ps.equipo_visitante_id as equipo_id,
        COUNT(*) as pj,
        SUM(CASE WHEN ps.ganador_id = ps.equipo_visitante_id THEN 1 ELSE 0 END) as g,
        SUM(CASE WHEN ps.ganador_id IS NULL THEN 1 ELSE 0 END) as e,
        SUM(CASE WHEN ps.ganador_id = ps.equipo_local_id THEN 1 ELSE 0 END) as p,
        SUM(ps.puntos_visitante) as gf,
        SUM(ps.puntos_local) as gc,
        SUM(CASE 
            WHEN ps.ganador_id = ps.equipo_visitante_id THEN 3
            WHEN ps.ganador_id IS NULL THEN 1
            ELSE 0
        END) as pts
    FROM partido_stats ps
    GROUP BY ps.torneo_id, ps.equipo_visitante_id
)
SELECT 
    tp.torneo_id,
    tp.equipo_id,
    e.nombre as equipo_nombre,
    e.logo_url,
    e.escudo_url,
    COALESCE(SUM(es.pj), 0)::integer as pj,
    COALESCE(SUM(es.g), 0)::integer as g,
    COALESCE(SUM(es.e), 0)::integer as e,
    COALESCE(SUM(es.p), 0)::integer as p,
    COALESCE(SUM(es.gf), 0)::integer as gf,
    COALESCE(SUM(es.gc), 0)::integer as gc,
    (COALESCE(SUM(es.gf), 0) - COALESCE(SUM(es.gc), 0))::integer as dg,
    COALESCE(SUM(es.pts), 0)::integer as pts
FROM public.torneo_participantes tp
JOIN public.equipos e ON e.id = tp.equipo_id
LEFT JOIN equipo_stats es ON es.torneo_id = tp.torneo_id AND es.equipo_id = tp.equipo_id
WHERE tp.status = 'aprobado'
GROUP BY tp.torneo_id, tp.equipo_id, e.nombre, e.logo_url, e.escudo_url
ORDER BY pts DESC, dg DESC, gf DESC;

COMMENT ON VIEW tabla_posiciones_view IS 'Vista calculada de tabla de posiciones con estadísticas completas por equipo y torneo';
