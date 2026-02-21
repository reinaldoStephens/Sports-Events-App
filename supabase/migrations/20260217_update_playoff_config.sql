-- Update existing tournaments with default playoff configuration

-- Add playoff_config to existing tournaments that don't have it
UPDATE torneos
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
  'playoff_config', jsonb_build_object(
    'usa_ida_vuelta', false,
    'fases_ida_vuelta', '[]'::jsonb,
    'final_ida_vuelta', false,
    'penales_si_empate_agregado', true,
    'usa_gol_visitante', false
  )
)
WHERE tipo IN ('eliminacion', 'grupos_eliminacion')
  AND (config IS NULL OR NOT config ? 'playoff_config');

-- Update existing jornadas with default values
UPDATE jornadas
SET 
  fase_estado = 'pendiente',
  es_ida_vuelta = false
WHERE fase_estado IS NULL;

-- Set fase_tipo based on nombre_fase for existing data
UPDATE jornadas
SET fase_tipo = CASE
  WHEN LOWER(nombre_fase) LIKE '%final%' AND LOWER(nombre_fase) NOT LIKE '%semi%' THEN 'final'
  WHEN LOWER(nombre_fase) LIKE '%semi%' THEN 'semifinals'
  WHEN LOWER(nombre_fase) LIKE '%cuarto%' OR LOWER(nombre_fase) LIKE '%quarter%' THEN 'quarterfinals'
  WHEN LOWER(nombre_fase) LIKE '%octavo%' OR LOWER(nombre_fase) LIKE '%16%' THEN 'round_of_16'
  WHEN LOWER(nombre_fase) LIKE '%grupo%' OR LOWER(nombre_fase) LIKE '%group%' THEN 'group'
  ELSE 'other'
END
WHERE fase_tipo IS NULL AND nombre_fase IS NOT NULL;

-- Verification
SELECT 
  'Torneos actualizados' as item,
  COUNT(*) as count
FROM torneos
WHERE config ? 'playoff_config'

UNION ALL

SELECT 
  'Jornadas con fase_estado' as item,
  COUNT(*) as count
FROM jornadas
WHERE fase_estado IS NOT NULL;
