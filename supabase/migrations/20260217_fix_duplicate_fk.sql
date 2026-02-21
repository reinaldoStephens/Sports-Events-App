-- Fix: Remove the old FK constraint that has SET NULL behavior
-- Keep only the one with CASCADE

-- Drop the old constraint with SET NULL
ALTER TABLE partidos
DROP CONSTRAINT IF EXISTS partidos_jornada_fk;

-- Verify: Check remaining constraints
SELECT 
    conname as constraint_name,
    confrelid::regclass as references_table,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END as on_delete
FROM pg_constraint
WHERE conrelid = 'partidos'::regclass
    AND confrelid = 'jornadas'::regclass;
