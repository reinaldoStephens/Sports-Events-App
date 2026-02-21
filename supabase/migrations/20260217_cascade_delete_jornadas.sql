-- Enable ON DELETE CASCADE for matches when a matchday (jornada) is deleted

-- 1. Drop existing foreign key constraint (if exists with a different name, this might need adjustment, but standard name is usually table_column_fkey)
ALTER TABLE partidos
DROP CONSTRAINT IF EXISTS partidos_jornada_id_fkey;

-- 2. Add foreign key with ON DELETE CASCADE
ALTER TABLE partidos
ADD CONSTRAINT partidos_jornada_id_fkey
FOREIGN KEY (jornada_id)
REFERENCES jornadas(id)
ON DELETE CASCADE;

-- Optional: Ensure match events are also deleted when a match is deleted (usually this is already the case, but good to ensure)
ALTER TABLE eventos_partido
DROP CONSTRAINT IF EXISTS eventos_partido_partido_id_fkey;

ALTER TABLE eventos_partido
ADD CONSTRAINT eventos_partido_partido_id_fkey
FOREIGN KEY (partido_id)
REFERENCES partidos(id)
ON DELETE CASCADE;
