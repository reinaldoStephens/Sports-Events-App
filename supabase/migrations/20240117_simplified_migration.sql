-- ============================================
-- SELF-SERVICE REGISTRATION - MIGRATION (SIMPLIFIED)
-- Execute this in Supabase SQL Editor
-- Can be run in sections if needed
-- ============================================

-- SECTION 1: Add new columns to existing tables
-- ============================================

-- Add delegado and contact info to equipos
ALTER TABLE public.equipos 
  ADD COLUMN IF NOT EXISTS delegado_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS telefono_contacto TEXT,
  ADD COLUMN IF NOT EXISTS direccion_cancha TEXT,
  ADD COLUMN IF NOT EXISTS bloqueado_edicion BOOLEAN DEFAULT false;

-- Add tournament control fields
ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS inscripciones_bloqueadas BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ventana_fichajes_abierta BOOLEAN DEFAULT false;

-- Add approval workflow fields to torneo_participantes
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participation_status') THEN
    CREATE TYPE participation_status AS ENUM ('pendiente', 'en_revision', 'aprobado', 'rechazado');
  END IF;
END $$;

ALTER TABLE public.torneo_participantes
  ADD COLUMN IF NOT EXISTS status participation_status DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS notas_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES auth.users(id);

-- SECTION 2: Create jugador_estadisticas table
-- ============================================

CREATE TABLE IF NOT EXISTS public.jugador_estadisticas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jugador_cedula TEXT NOT NULL,  -- Will be FK after deportistas migration
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  goles INTEGER DEFAULT 0,
  amarillas INTEGER DEFAULT 0,
  rojas INTEGER DEFAULT 0,
  partidos_jugados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SECTION 3: Modify deportistas table (CAREFUL - involves PK change)
-- ============================================

-- Step 3a: Add new columns to deportistas
ALTER TABLE public.deportistas
  ADD COLUMN IF NOT EXISTS numero_cedula TEXT,
  ADD COLUMN IF NOT EXISTS nombre_deportivo TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS edad INTEGER,
  ADD COLUMN IF NOT EXISTS dorsal INTEGER;

-- Step 3b: Ensure equipo_id exists
ALTER TABLE public.deportistas
  ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES public.equipos(id) ON DELETE CASCADE;

-- Step 3c: Update capitan_id in equipos to TEXT (will reference cedula later)
-- Note: This is complex - you may need to set capitan_id to NULL first
UPDATE public.equipos SET capitan_id = NULL WHERE capitan_id IS NOT NULL;
ALTER TABLE public.equipos ALTER COLUMN capitan_id TYPE TEXT;

COMMENT ON TABLE public.jugador_estadisticas IS 'Player statistics per tournament';
COMMENT ON COLUMN public.deportistas.numero_cedula IS 'Costa Rican national ID (cédula) - will become PK';
COMMENT ON COLUMN public.deportistas.nombre_deportivo IS 'Public display name for privacy';

-- SECTION 4: Create helpful functions
-- ============================================

-- Age calculation function
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update edad when fecha_nacimiento changes
CREATE OR REPLACE FUNCTION update_deportista_edad()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fecha_nacimiento IS NOT NULL THEN
    NEW.edad := calculate_age(NEW.fecha_nacimiento);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_deportista_edad ON public.deportistas;
CREATE TRIGGER trigger_update_deportista_edad
  BEFORE INSERT OR UPDATE OF fecha_nacimiento ON public.deportistas
  FOR EACH ROW
  EXECUTE FUNCTION update_deportista_edad();

-- SECTION 5: Add constraints (run after data migration)
-- ============================================

-- Dorsal unique per team
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_dorsal_per_team'
  ) THEN
    ALTER TABLE public.deportistas ADD CONSTRAINT unique_dorsal_per_team 
      UNIQUE (equipo_id, dorsal);
  END IF;
END $$;

-- Jugador stats unique per tournament
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_player_tournament_stats'
  ) THEN
    ALTER TABLE public.jugador_estadisticas
      ADD CONSTRAINT unique_player_tournament_stats 
      UNIQUE (jugador_cedula, torneo_id);
  END IF;
END $$;

-- Add FK for jugador_estadisticas (will work after cedula becomes PK)
-- ALTER TABLE public.jugador_estadisticas
--   ADD CONSTRAINT fk_jugador_cedula 
--   FOREIGN KEY (jugador_cedula) REFERENCES public.deportistas(numero_cedula) ON DELETE CASCADE;

-- SECTION 6: Update RLS policies
-- ============================================

-- Allow delegados to read their own teams
DROP POLICY IF EXISTS "Delegados can view their teams" ON public.equipos;
CREATE POLICY "Delegados can view their teams" ON public.equipos
  FOR SELECT USING (
    auth.uid() = delegado_id OR
    auth.jwt() ->> 'role' IN ('admin', 'super_admin')
  );

-- Allow delegados to update their unlocked teams
DROP POLICY IF EXISTS "Delegados can update their teams" ON public.equipos;
CREATE POLICY "Delegados can update their teams" ON public.equipos
  FOR UPDATE USING (
    (auth.uid() = delegado_id AND bloqueado_edicion = false) OR
    auth.jwt() ->> 'role' = 'super_admin'
  );

-- Allow public to view approved teams in tournaments
DROP POLICY IF EXISTS "Public can view approved teams" ON public.torneo_participantes;
CREATE POLICY "Public can view approved teams" ON public.torneo_participantes
  FOR SELECT USING (status = 'aprobado');

COMMENT ON DATABASE postgres IS 'Self-service registration migration applied';

SELECT 'Migration completed successfully!' AS status;
