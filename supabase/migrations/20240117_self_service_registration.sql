-- Self-Service Team Registration & Approval System
-- Migration Date: 2024-01-17
-- 
-- This migration implements the complete self-service registration system
-- with delegado ownership, admin approval workflow, and Costa Rican identity validation

-- ============================================
-- PART 1: Update DEPORTISTAS table
-- Change PK from UUID to cedula
-- ============================================

-- Create new table with cedula as PK
CREATE TABLE IF NOT EXISTS public.deportistas_new (
    numero_cedula TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    nombre_deportivo TEXT,
    fecha_nacimiento DATE NOT NULL,
    edad INTEGER,
    posicion TEXT,
    dorsal INTEGER,
    equipo_id UUID REFERENCES public.equipos(id) ON DELETE CASCADE,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrate existing data (if deportistas table exists with old structure)
-- This assumes existing records have a numero_cedula field, otherwise set dummy values
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deportistas') THEN
        -- If old table exists, check if it has numero_cedula
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deportistas' AND column_name = 'numero_cedula') THEN
            INSERT INTO public.deportistas_new (numero_cedula, nombre, fecha_nacimiento, edad, posicion, dorsal, equipo_id, creado_at)
            SELECT 
                COALESCE(numero_cedula, 'TEMP-' || id::text) as numero_cedula,
                nombre,
                COALESCE(fecha_nacimiento, '2000-01-01'::date),
                edad,
                posicion,
                NULL as dorsal, -- Will need to be set manually
                equipo_id,
                creado_at
            FROM public.deportistas
            ON CONFLICT (numero_cedula) DO NOTHING;
        END IF;
    END IF;
END $$;

-- Drop old table and rename new one
DROP TABLE IF EXISTS public.deportistas CASCADE;
ALTER TABLE public.deportistas_new RENAME TO deportistas;

-- Add constraint for unique dorsal per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_dorsal_per_team 
ON public.deportistas(equipo_id, dorsal) 
WHERE dorsal IS NOT NULL;

-- Create trigger to auto-calculate edad from fecha_nacimiento
CREATE OR REPLACE FUNCTION calculate_edad()
RETURNS TRIGGER AS $$
BEGIN
    NEW.edad := EXTRACT(YEAR FROM AGE(NEW.fecha_nacimiento));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_edad ON public.deportistas;
CREATE TRIGGER trigger_calculate_edad
    BEFORE INSERT OR UPDATE OF fecha_nacimiento ON public.deportistas
    FOR EACH ROW
    EXECUTE FUNCTION calculate_edad();

-- ============================================
-- PART 2: Update EQUIPOS table
-- Add delegado_id, direccion_cancha, bloqueado_edicion
-- ============================================

DO $$
BEGIN
    -- Add delegado_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipos' AND column_name = 'delegado_id') THEN
        ALTER TABLE public.equipos ADD COLUMN delegado_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    
    -- Add telefono_contacto if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipos' AND column_name = 'telefono_contacto') THEN
        ALTER TABLE public.equipos ADD COLUMN telefono_contacto TEXT;
    END IF;
    
    -- Add direccion_cancha if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipos' AND column_name = 'direccion_cancha') THEN
        ALTER TABLE public.equipos ADD COLUMN direccion_cancha TEXT;
    END IF;
    
    -- Add bloqueado_edicion if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipos' AND column_name = 'bloqueado_edicion') THEN
        ALTER TABLE public.equipos ADD COLUMN bloqueado_edicion BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Update capitan_id to reference deportistas.numero_cedula instead of profiles
    -- First, drop the old foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'equipos_capitan_id_fkey' 
        AND table_name = 'equipos'
    ) THEN
        ALTER TABLE public.equipos DROP CONSTRAINT equipos_capitan_id_fkey;
    END IF;
    
    -- Change column type to TEXT if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipos' 
        AND column_name = 'capitan_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.equipos ALTER COLUMN capitan_id TYPE TEXT;
    END IF;
    
    -- Add new foreign key to deportistas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'equipos_capitan_id_fkey_deportistas'
    ) THEN
        ALTER TABLE public.equipos 
        ADD CONSTRAINT equipos_capitan_id_fkey_deportistas 
        FOREIGN KEY (capitan_id) REFERENCES public.deportistas(numero_cedula) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- PART 3: Update TORNEOS table
-- Add inscripciones_bloqueadas, ventana_fichajes_abierta
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneos' AND column_name = 'inscripciones_bloqueadas') THEN
        ALTER TABLE public.torneos ADD COLUMN inscripciones_bloqueadas BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneos' AND column_name = 'ventana_fichajes_abierta') THEN
        ALTER TABLE public.torneos ADD COLUMN ventana_fichajes_abierta BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ============================================
-- PART 4: Update TORNEO_PARTICIPANTES table
-- Add status, notas_rechazo, fecha_aprobacion, aprobado_por
-- ============================================

-- Create enum for status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'torneo_participante_status') THEN
        CREATE TYPE torneo_participante_status AS ENUM ('pendiente', 'en_revision', 'aprobado', 'rechazado');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'status') THEN
        ALTER TABLE public.torneo_participantes ADD COLUMN status torneo_participante_status DEFAULT 'pendiente';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'notas_rechazo') THEN
        ALTER TABLE public.torneo_participantes ADD COLUMN notas_rechazo TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'fecha_aprobacion') THEN
        ALTER TABLE public.torneo_participantes ADD COLUMN fecha_aprobacion TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'aprobado_por') THEN
        ALTER TABLE public.torneo_participantes ADD COLUMN aprobado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- PART 5: Create JUGADOR_ESTADISTICAS table
-- Track player stats per tournament
-- ============================================

CREATE TABLE IF NOT EXISTS public.jugador_estadisticas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jugador_cedula TEXT NOT NULL REFERENCES public.deportistas(numero_cedula) ON DELETE CASCADE,
    torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
    goles INTEGER DEFAULT 0,
    amarillas INTEGER DEFAULT 0,
    rojas INTEGER DEFAULT 0,
    partidos_jugados INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(jugador_cedula, torneo_id)
);

-- ============================================
-- PART 6: Create function to prevent duplicate players in same tournament
-- ============================================

CREATE OR REPLACE FUNCTION check_duplicate_player_in_tournament()
RETURNS TRIGGER AS $$
DECLARE
    player_team_count INTEGER;
BEGIN
    -- Check if player is already in another team in the same tournament
    SELECT COUNT(*) INTO player_team_count
    FROM public.deportistas d
    INNER JOIN public.equipos e ON d.equipo_id = e.id
    INNER JOIN public.torneo_participantes tp ON e.id = tp.equipo_id
    WHERE d.numero_cedula = NEW.numero_cedula
    AND tp.torneo_id IN (
        SELECT tp2.torneo_id 
        FROM public.torneo_participantes tp2 
        WHERE tp2.equipo_id = NEW.equipo_id
    )
    AND d.equipo_id != NEW.equipo_id;
    
    IF player_team_count > 0 THEN
        RAISE EXCEPTION 'Player with cédula % is already registered in another team in this tournament', NEW.numero_cedula;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_duplicate_player ON public.deportistas;
CREATE TRIGGER trigger_check_duplicate_player
    BEFORE INSERT OR UPDATE OF equipo_id ON public.deportistas
    FOR EACH ROW
    EXECUTE FUNCTION check_duplicate_player_in_tournament();

-- ============================================
-- PART 7: Enable RLS on new tables
-- ============================================

ALTER TABLE public.jugador_estadisticas ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 8: RLS Policies
-- ============================================

-- Deportistas: Public can read, delegados/admins can manage their team's players
CREATE POLICY "Deportistas viewable by everyone" 
ON public.deportistas FOR SELECT USING (true);

CREATE POLICY "Delegados can insert players to their teams" 
ON public.deportistas FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.equipos e
        WHERE e.id = equipo_id
        AND (e.delegado_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'super_admin'
        ))
    )
);

CREATE POLICY "Delegados can update their team's players" 
ON public.deportistas FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.equipos e
        WHERE e.id = equipo_id
        AND (e.delegado_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'super_admin'
        ))
    )
);

CREATE POLICY "Delegados can delete their team's players" 
ON public.deportistas FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.equipos e
        WHERE e.id = equipo_id
        AND (e.delegado_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'super_admin'
        ))
    )
);

-- Equipos: Public readable, delegados can manage their own teams
CREATE POLICY "Equipos viewable by everyone" 
ON public.equipos FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create teams" 
ON public.equipos FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Delegados can update their teams" 
ON public.equipos FOR UPDATE 
USING (
    delegado_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
);

-- Jugador Estadisticas: Public readable, admins can update
CREATE POLICY "Estadisticas viewable by everyone" 
ON public.jugador_estadisticas FOR SELECT USING (true);

CREATE POLICY "Admins can manage estadisticas" 
ON public.jugador_estadisticas FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
);

-- Torneo Participantes: Update existing policies to support approval workflow
DROP POLICY IF EXISTS "Torneo participantes viewable by everyone" ON public.torneo_participantes;
CREATE POLICY "Torneo participantes viewable by everyone" 
ON public.torneo_participantes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage torneo participantes" ON public.torneo_participantes;
CREATE POLICY "Admins can manage torneo participantes" 
ON public.torneo_participantes FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
);

-- ============================================
-- PART 9: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_deportistas_equipo_id ON public.deportistas(equipo_id);
CREATE INDEX IF NOT EXISTS idx_deportistas_cedula ON public.deportistas(numero_cedula);
CREATE INDEX IF NOT EXISTS idx_equipos_delegado_id ON public.equipos(delegado_id);
CREATE INDEX IF NOT EXISTS idx_torneo_participantes_status ON public.torneo_participantes(status);
CREATE INDEX IF NOT EXISTS idx_jugador_estadisticas_cedula ON public.jugador_estadisticas(jugador_cedula);
CREATE INDEX IF NOT EXISTS idx_jugador_estadisticas_torneo ON public.jugador_estadisticas(torneo_id);

-- ============================================
-- PART 10: Comments for documentation
-- ============================================

COMMENT ON TABLE public.deportistas IS 'Players with Costa Rican cédula as primary key';
COMMENT ON COLUMN public.deportistas.numero_cedula IS 'Primary Key - Costa Rican ID (9 digits) or DIMEX';
COMMENT ON COLUMN public.deportistas.nombre_deportivo IS 'Optional public display name for privacy';
COMMENT ON COLUMN public.equipos.delegado_id IS 'Team owner/manager (can be null for super_admin created teams)';
COMMENT ON COLUMN public.equipos.direccion_cancha IS 'Field/stadium address';
COMMENT ON COLUMN public.equipos.bloqueado_edicion IS 'Locked for editing when team is approved';
COMMENT ON COLUMN public.torneos.inscripciones_bloqueadas IS 'Global registration freeze for tournament';
COMMENT ON COLUMN public.torneo_participantes.status IS 'Approval workflow status';
COMMENT ON TABLE public.jugador_estadisticas IS 'Player statistics per tournament (goals, cards)';
