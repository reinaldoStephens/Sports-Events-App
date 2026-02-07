-- Migration: Add fecha_hora to jornadas and prevent duplicate matches
-- Date: 2024-01-23

-- 1. Remove old date fields and add single fecha_hora to jornadas
ALTER TABLE public.jornadas 
DROP COLUMN IF EXISTS fecha_inicio,
DROP COLUMN IF EXISTS fecha_final,
ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMP WITH TIME ZONE;

-- 2. Add unique constraint to prevent duplicate matches in same jornada
-- This prevents having the same two teams play each other twice in the same jornada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_match_per_jornada'
    ) THEN
        ALTER TABLE public.partidos
        ADD CONSTRAINT unique_match_per_jornada 
        UNIQUE (jornada_id, equipo_local_id, equipo_visitante_id);
    END IF;
END $$;

-- 3. Add index for performance on match lookups
CREATE INDEX IF NOT EXISTS idx_partidos_jornada_equipos 
ON public.partidos(jornada_id, equipo_local_id, equipo_visitante_id);

-- 4. Add comments for documentation
COMMENT ON COLUMN public.jornadas.fecha_hora IS 'Fecha y hora de la jornada. Debe ser posterior a la fecha de inicio del torneo.';
COMMENT ON CONSTRAINT unique_match_per_jornada ON public.partidos IS 'Previene que los mismos equipos se enfrenten más de una vez en la misma jornada';
