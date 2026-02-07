-- Multi-Sport Support Migration (CORRECTED)
-- Date: 2024-01-29
-- 
-- This migration transforms the system to support multiple sports

-- ============================================
-- PART 1: Update DEPORTES table structure
-- ============================================

-- Add missing columns to deportes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deportes' AND column_name = 'descripcion'
    ) THEN
        ALTER TABLE public.deportes ADD COLUMN descripcion TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deportes' AND column_name = 'icono'
    ) THEN
        ALTER TABLE public.deportes ADD COLUMN icono TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deportes' AND column_name = 'configuracion'
    ) THEN
        ALTER TABLE public.deportes ADD COLUMN configuracion JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deportes' AND column_name = 'activo'
    ) THEN
        ALTER TABLE public.deportes ADD COLUMN activo BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Insert default sports if they don't exist
INSERT INTO public.deportes (nombre, slug, descripcion, icono, configuracion)
VALUES 
    ('Fútbol', 'futbol', 'Fútbol asociación', '⚽', 
     '{"scoreLabel": "Goles", "statsLabels": {"favor": "GF", "contra": "GC", "diferencia": "DG"}, "pointsForWin": 3, "pointsForDraw": 1, "pointsForLoss": 0, "hasDraws": true}'::jsonb),
    ('Volleyball', 'volleyball', 'Volleyball', '🏐',
     '{"scoreLabel": "Sets", "statsLabels": {"favor": "SF", "contra": "SC", "diferencia": "DS"}, "pointsForWin": 3, "pointsForDraw": 0, "pointsForLoss": 0, "hasDraws": false}'::jsonb),
    ('Basketball', 'basketball', 'Basketball', '🏀',
     '{"scoreLabel": "Puntos", "statsLabels": {"favor": "PF", "contra": "PC", "diferencia": "DP"}, "pointsForWin": 2, "pointsForDraw": 0, "pointsForLoss": 0, "hasDraws": false}'::jsonb),
    ('Beisbol', 'beisbol', 'Beisbol', '⚾',
     '{"scoreLabel": "Carreras", "statsLabels": {"favor": "CF", "contra": "CC", "diferencia": "DC"}, "pointsForWin": 2, "pointsForDraw": 0, "pointsForLoss": 0, "hasDraws": false}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    icono = EXCLUDED.icono,
    configuracion = EXCLUDED.configuracion;

-- Enable RLS on deportes
ALTER TABLE public.deportes ENABLE ROW LEVEL SECURITY;

-- Deportes are publicly viewable
DROP POLICY IF EXISTS "Deportes viewable by everyone" ON public.deportes;
CREATE POLICY "Deportes viewable by everyone" 
ON public.deportes FOR SELECT USING (true);

-- Only admins can manage deportes
DROP POLICY IF EXISTS "Admins can manage deportes" ON public.deportes;
CREATE POLICY "Admins can manage deportes" 
ON public.deportes FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
);

-- ============================================
-- PART 2: Add deporte_id to TORNEOS
-- ============================================

DO $$
BEGIN
    -- Add deporte_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'torneos' AND column_name = 'deporte_id'
    ) THEN
        ALTER TABLE public.torneos 
        ADD COLUMN deporte_id UUID REFERENCES public.deportes(id) ON DELETE SET NULL;
        
        -- Set default to Fútbol for existing tournaments
        UPDATE public.torneos 
        SET deporte_id = (SELECT id FROM public.deportes WHERE slug = 'futbol' LIMIT 1)
        WHERE deporte_id IS NULL;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_torneos_deporte_id ON public.torneos(deporte_id);

-- ============================================
-- PART 3: Rename scoring fields in PARTIDOS
-- ============================================

DO $$
BEGIN
    -- Rename goles_local to puntos_local
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partidos' AND column_name = 'goles_local'
    ) THEN
        ALTER TABLE public.partidos 
        RENAME COLUMN goles_local TO puntos_local;
    END IF;
    
    -- Rename goles_visitante to puntos_visitante
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partidos' AND column_name = 'goles_visitante'
    ) THEN
        ALTER TABLE public.partidos 
        RENAME COLUMN goles_visitante TO puntos_visitante;
    END IF;
    
    -- Add detalles_partido JSONB for sport-specific data
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partidos' AND column_name = 'detalles_partido'
    ) THEN
        ALTER TABLE public.partidos 
        ADD COLUMN detalles_partido JSONB DEFAULT '{}';
    END IF;
    
    -- Add torneo_id to partidos if it doesn't exist (for easier sport lookup)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partidos' AND column_name = 'torneo_id'
    ) THEN
        ALTER TABLE public.partidos 
        ADD COLUMN torneo_id UUID REFERENCES public.torneos(id) ON DELETE CASCADE;
        
        -- Populate torneo_id from jornada relationship
        UPDATE public.partidos p
        SET torneo_id = j.torneo_id
        FROM public.jornadas j
        WHERE p.jornada_id = j.id AND p.torneo_id IS NULL;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_partidos_torneo_id ON public.partidos(torneo_id);

-- ============================================
-- PART 4: Add coaching staff to EQUIPOS
-- ============================================

DO $$
BEGIN
    -- Add director_tecnico field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipos' AND column_name = 'director_tecnico'
    ) THEN
        ALTER TABLE public.equipos 
        ADD COLUMN director_tecnico TEXT;
    END IF;
    
    -- Add asistente_tecnico field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipos' AND column_name = 'asistente_tecnico'
    ) THEN
        ALTER TABLE public.equipos 
        ADD COLUMN asistente_tecnico TEXT;
    END IF;
END $$;

-- ============================================
-- PART 5: Rename goles to puntos in JUGADOR_ESTADISTICAS
-- ============================================

DO $$
BEGIN
    -- Rename goles to puntos
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jugador_estadisticas' AND column_name = 'goles'
    ) THEN
        ALTER TABLE public.jugador_estadisticas 
        RENAME COLUMN goles TO puntos;
    END IF;
END $$;

-- ============================================
-- PART 6: Add comments for documentation
-- ============================================

COMMENT ON TABLE public.deportes IS 'Catalog of supported sports with configuration';
COMMENT ON COLUMN public.deportes.configuracion IS 'JSONB with sport-specific config: scoreLabel, statsLabels, points system';
COMMENT ON COLUMN public.torneos.deporte_id IS 'Sport type for this tournament';
COMMENT ON COLUMN public.partidos.puntos_local IS 'Score for home team (generic: goals, sets, points, runs)';
COMMENT ON COLUMN public.partidos.puntos_visitante IS 'Score for away team (generic: goals, sets, points, runs)';
COMMENT ON COLUMN public.partidos.detalles_partido IS 'Sport-specific match details (e.g., sets breakdown, quarters, innings)';
COMMENT ON COLUMN public.equipos.director_tecnico IS 'Head coach name';
COMMENT ON COLUMN public.equipos.asistente_tecnico IS 'Assistant coach name';
COMMENT ON COLUMN public.jugador_estadisticas.puntos IS 'Generic scoring stat (goals, points, runs, etc.)';

-- ============================================
-- PART 7: Create helper function to get sport config
-- ============================================

CREATE OR REPLACE FUNCTION get_sport_config(torneo_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    sport_config JSONB;
BEGIN
    SELECT d.configuracion INTO sport_config
    FROM public.torneos t
    JOIN public.deportes d ON t.deporte_id = d.id
    WHERE t.id = torneo_uuid;
    
    RETURN COALESCE(sport_config, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_sport_config IS 'Get sport configuration for a tournament';
