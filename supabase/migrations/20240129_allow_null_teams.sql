-- Allow NULL values for equipo_local_id and equipo_visitante_id
-- This is necessary for elimination brackets where future matches have 'TBD' teams
DO $$
BEGIN
    ALTER TABLE partidos ALTER COLUMN equipo_local_id DROP NOT NULL;
    ALTER TABLE partidos ALTER COLUMN equipo_visitante_id DROP NOT NULL;
END $$;
