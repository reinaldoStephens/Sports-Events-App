-- DIAGNOSTIC SCRIPT: Check for existing jornadas and constraint
-- Run this in Supabase SQL Editor to diagnose the duplicate key issue

-- 1. Check the constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM 
    pg_constraint c
JOIN 
    pg_class t ON c.conrelid = t.oid
WHERE 
    t.relname = 'jornadas'
    AND conname LIKE '%jornada%';

-- 2. Check all existing jornadas (grouped by tournament)
SELECT 
    torneo_id,
    COUNT(*) as total_jornadas,
    MIN(numero_jornada) as min_numero,
    MAX(numero_jornada) as max_numero,
    array_agg(DISTINCT numero_jornada ORDER BY numero_jornada) as numeros_usados
FROM jornadas
GROUP BY torneo_id
ORDER BY torneo_id;

-- 3. Check for duplicate numero_jornada within same torneo_id
SELECT 
    torneo_id,
    numero_jornada,
    COUNT(*) as count
FROM jornadas
GROUP BY torneo_id, numero_jornada
HAVING COUNT(*) > 1;

-- 4. If you want to clean up jornadas for a specific tournament, use this:
-- REPLACE 'YOUR_TORNEO_ID_HERE' with the actual tournament ID
-- DELETE FROM jornadas WHERE torneo_id = 'YOUR_TORNEO_ID_HERE';
