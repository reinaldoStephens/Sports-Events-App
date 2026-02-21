-- Comprehensive check of all foreign key constraints related to partidos and jornadas

-- 1. Check FK from partidos to jornadas
SELECT 
    'partidos -> jornadas' as relationship,
    conname as constraint_name,
    confdeltype as delete_action,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END as delete_action_readable
FROM pg_constraint
WHERE conrelid = 'partidos'::regclass
    AND confrelid = 'jornadas'::regclass;

-- 2. Check FK from eventos_partido to partidos
SELECT 
    'eventos_partido -> partidos' as relationship,
    conname as constraint_name,
    confdeltype as delete_action,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END as delete_action_readable
FROM pg_constraint
WHERE conrelid = 'eventos_partido'::regclass
    AND confrelid = 'partidos'::regclass;

-- 3. List ALL foreign keys on partidos table
SELECT 
    conname as constraint_name,
    conrelid::regclass as from_table,
    confrelid::regclass as to_table,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END as on_delete
FROM pg_constraint
WHERE conrelid = 'partidos'::regclass
    AND contype = 'f';
