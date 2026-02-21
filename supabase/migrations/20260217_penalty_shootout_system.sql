-- Migration: Penalty Shootout System
-- Adds support for penalty shootouts, extra time tracking, and UEFA-style tiebreaking
-- Date: 2026-02-17

-- 1. Add extra time goal tracking to partidos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'goles_local_tiempo_extra') THEN
        ALTER TABLE public.partidos ADD COLUMN goles_local_tiempo_extra INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'goles_visitante_tiempo_extra') THEN
        ALTER TABLE public.partidos ADD COLUMN goles_visitante_tiempo_extra INTEGER;
    END IF;
END $$;

-- 2. Add penalty shootout tracking to partidos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'penales_jugados') THEN
        ALTER TABLE public.partidos ADD COLUMN penales_jugados BOOLEAN DEFAULT false NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'penales_local') THEN
        ALTER TABLE public.partidos ADD COLUMN penales_local INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'penales_visitante') THEN
        ALTER TABLE public.partidos ADD COLUMN penales_visitante INTEGER;
    END IF;
END $$;

-- 3. Add away goal rule configuration to tournaments
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneos' AND column_name = 'usa_gol_visitante') THEN
        ALTER TABLE public.torneos ADD COLUMN usa_gol_visitante BOOLEAN DEFAULT false NOT NULL;
    END IF;
END $$;

-- 4. Update eventos_partido to support extra time goals
-- Modify the check constraint to allow 'gol_tiempo_extra' as a valid event type
ALTER TABLE public.eventos_partido DROP CONSTRAINT IF EXISTS eventos_partido_tipo_evento_check;
ALTER TABLE public.eventos_partido ADD CONSTRAINT eventos_partido_tipo_evento_check 
    CHECK (tipo_evento IN ('gol', 'gol_tiempo_extra', 'tarjeta_amarilla', 'tarjeta_roja', 'sustitucion'));

-- 5. Add constraint: penalty scores are only valid when penalties were played
ALTER TABLE public.partidos DROP CONSTRAINT IF EXISTS partidos_penales_valid_check;
ALTER TABLE public.partidos ADD CONSTRAINT partidos_penales_valid_check
    CHECK (
        (penales_jugados = false AND penales_local IS NULL AND penales_visitante IS NULL) OR
        (penales_jugados = true AND penales_local IS NOT NULL AND penales_visitante IS NOT NULL)
    );

-- 6. Add constraint: penalty scores must be non-negative and reasonable
ALTER TABLE public.partidos DROP CONSTRAINT IF EXISTS partidos_penales_range_check;
ALTER TABLE public.partidos ADD CONSTRAINT partidos_penales_range_check
    CHECK (
        (penales_local IS NULL OR (penales_local >= 0 AND penales_local <= 20)) AND
        (penales_visitante IS NULL OR (penales_visitante >= 0 AND penales_visitante <= 20))
    );

-- 7. Add constraint: extra time goals must be non-negative
ALTER TABLE public.partidos DROP CONSTRAINT IF EXISTS partidos_extra_time_range_check;
ALTER TABLE public.partidos ADD CONSTRAINT partidos_extra_time_range_check
    CHECK (
        (goles_local_tiempo_extra IS NULL OR goles_local_tiempo_extra >= 0) AND
        (goles_visitante_tiempo_extra IS NULL OR goles_visitante_tiempo_extra >= 0)
    );

-- 8. Create index for penalty shootout queries
CREATE INDEX IF NOT EXISTS idx_partidos_penales ON public.partidos(penales_jugados) WHERE penales_jugados = true;

-- 9. Add comment to document the schema
COMMENT ON COLUMN public.partidos.goles_local_tiempo_extra IS 'Goals scored by home team during extra time (91-120 minutes)';
COMMENT ON COLUMN public.partidos.goles_visitante_tiempo_extra IS 'Goals scored by away team during extra time (91-120 minutes)';
COMMENT ON COLUMN public.partidos.penales_jugados IS 'Indicates if penalty shootout was played';
COMMENT ON COLUMN public.partidos.penales_local IS 'Penalty shootout score for home team';
COMMENT ON COLUMN public.partidos.penales_visitante IS 'Penalty shootout score for away team';
COMMENT ON COLUMN public.torneos.usa_gol_visitante IS 'Enable away goals rule for tiebreaking (UEFA pre-2021 style)';
