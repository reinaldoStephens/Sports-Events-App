-- Migration: Groups + Playoff Tournament Support
-- Adds 'grupo' column to torneo_participantes for group assignment
-- Date: 2026-02-09

-- 1. Add 'grupo' column to 'torneo_participantes'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'grupo') THEN
        ALTER TABLE public.torneo_participantes ADD COLUMN grupo text;
    END IF;
END $$;

-- 2. Add index for grupo filtering
CREATE INDEX IF NOT EXISTS idx_torneo_participantes_grupo ON public.torneo_participantes(torneo_id, grupo) WHERE grupo IS NOT NULL;

-- 3. Add comment for documentation
COMMENT ON COLUMN public.torneo_participantes.grupo IS 'Group assignment for grupos_eliminacion tournaments (e.g., A, B, C, D). NULL for non-group tournaments.';
