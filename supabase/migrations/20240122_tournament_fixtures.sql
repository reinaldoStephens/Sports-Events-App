-- Migration: Tournament Fixture System Extensions
-- Adds support for elimination brackets and automatic standings calculation
-- Date: 2024-01-22

-- 1. Add fields to 'partidos' for elimination tournaments
DO $$
BEGIN
    -- Add 'ronda' field for elimination round identification (R1, R2, Q, SF, F)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'ronda') THEN
        ALTER TABLE public.partidos ADD COLUMN ronda text;
    END IF;

    -- Add 'siguiente_partido_id' for bracket linking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'siguiente_partido_id') THEN
        ALTER TABLE public.partidos ADD COLUMN siguiente_partido_id uuid REFERENCES public.partidos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Add 'seed' field to 'torneo_participantes' for seeding in elimination tournaments
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'seed') THEN
        ALTER TABLE public.torneo_participantes ADD COLUMN seed integer;
    END IF;
END $$;

-- 3. Create PostgreSQL View for Standings Calculation
-- This replicates the logic from standings.ts for better performance
CREATE OR REPLACE VIEW tabla_posiciones_view AS
WITH partido_stats AS (
    SELECT 
        p.id as partido_id,
        p.equipo_local_id,
        p.equipo_visitante_id,
        p.goles_local,
        p.goles_visitante,
        j.torneo_id,
        CASE 
            WHEN p.goles_local > p.goles_visitante THEN p.equipo_local_id
            WHEN p.goles_visitante > p.goles_local THEN p.equipo_visitante_id
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
        SUM(ps.goles_local) as gf,
        SUM(ps.goles_visitante) as gc,
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
        SUM(ps.goles_visitante) as gf,
        SUM(ps.goles_local) as gc,
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

-- 4. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_partidos_ronda ON public.partidos(ronda) WHERE ronda IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partidos_siguiente ON public.partidos(siguiente_partido_id) WHERE siguiente_partido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_torneo_participantes_seed ON public.torneo_participantes(torneo_id, seed) WHERE seed IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jornadas_torneo ON public.jornadas(torneo_id, numero_jornada);

-- 5. Add comments for documentation
COMMENT ON COLUMN public.partidos.ronda IS 'Ronda para torneos de eliminación: R1, R2, R3, Q (cuartos), SF (semis), F (final)';
COMMENT ON COLUMN public.partidos.siguiente_partido_id IS 'ID del partido siguiente en el bracket de eliminación';
COMMENT ON COLUMN public.torneo_participantes.seed IS 'Número de semilla para seeding en torneos de eliminación (1=mejor, mayor=peor)';
COMMENT ON VIEW tabla_posiciones_view IS 'Vista calculada de tabla de posiciones con estadísticas completas por equipo y torneo';
