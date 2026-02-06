-- Add seed column to torneo_participantes if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'torneo_participantes' AND column_name = 'seed') THEN
        ALTER TABLE torneo_participantes ADD COLUMN seed INTEGER;
    END IF;
END $$;

-- Add ronda column to partidos if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'ronda') THEN
        ALTER TABLE partidos ADD COLUMN ronda INTEGER;
    END IF;
END $$;

-- Add siguiente_partido_id column to partidos if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partidos' AND column_name = 'siguiente_partido_id') THEN
        ALTER TABLE partidos ADD COLUMN siguiente_partido_id UUID REFERENCES partidos(id);
    END IF;
END $$;
