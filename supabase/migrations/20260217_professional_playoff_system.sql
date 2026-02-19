-- Migration: Professional Playoff System
-- Adds support for two-legged ties, aggregate scoring, and phase state management

-- ============================================================================
-- PART 1: Update jornadas table for phase management
-- ============================================================================

-- Add phase management columns
ALTER TABLE jornadas
ADD COLUMN IF NOT EXISTS fase_tipo VARCHAR(50),
ADD COLUMN IF NOT EXISTS fase_estado VARCHAR(20) DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS es_ida_vuelta BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_partidos INTEGER;

-- Add check constraint for fase_estado
ALTER TABLE jornadas
DROP CONSTRAINT IF EXISTS jornadas_fase_estado_check;

ALTER TABLE jornadas
ADD CONSTRAINT jornadas_fase_estado_check 
CHECK (fase_estado IN ('pendiente', 'en_curso', 'completada', 'bloqueada'));

-- Add comments for documentation
COMMENT ON COLUMN jornadas.fase_tipo IS 'Type of phase: group, round_of_16, quarterfinals, semifinals, final, etc.';
COMMENT ON COLUMN jornadas.fase_estado IS 'Phase state: pendiente, en_curso, completada, bloqueada';
COMMENT ON COLUMN jornadas.es_ida_vuelta IS 'True if this phase uses two-legged ties (home/away)';
COMMENT ON COLUMN jornadas.max_partidos IS 'Maximum number of matches allowed in this phase (null = unlimited)';

-- ============================================================================
-- PART 2: Update partidos table for two-legged ties
-- ============================================================================

-- Add two-legged tie columns
ALTER TABLE partidos
ADD COLUMN IF NOT EXISTS es_partido_ida BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS es_partido_vuelta BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partido_relacionado_id UUID REFERENCES partidos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS marcador_agregado_local INTEGER,
ADD COLUMN IF NOT EXISTS marcador_agregado_visitante INTEGER,
ADD COLUMN IF NOT EXISTS ganador_agregado_id UUID REFERENCES equipos(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_partidos_relacionado ON partidos(partido_relacionado_id);
CREATE INDEX IF NOT EXISTS idx_partidos_ganador_agregado ON partidos(ganador_agregado_id);

-- Add comments
COMMENT ON COLUMN partidos.es_partido_ida IS 'True if this is the first leg (home match for equipo_local)';
COMMENT ON COLUMN partidos.es_partido_vuelta IS 'True if this is the second leg (return match)';
COMMENT ON COLUMN partidos.partido_relacionado_id IS 'Links to the other leg of the tie';
COMMENT ON COLUMN partidos.marcador_agregado_local IS 'Aggregate score for local team (calculated after both legs)';
COMMENT ON COLUMN partidos.marcador_agregado_visitante IS 'Aggregate score for visiting team (calculated after both legs)';
COMMENT ON COLUMN partidos.ganador_agregado_id IS 'Winner determined by aggregate score';

-- ============================================================================
-- PART 3: Create helper function to check phase completion
-- ============================================================================

CREATE OR REPLACE FUNCTION check_phase_completion(jornada_uuid UUID)
RETURNS TABLE(
  fase_completa BOOLEAN,
  partidos_totales INTEGER,
  partidos_finalizados INTEGER,
  partidos_pendientes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE estado_partido = 'finalizado') = COUNT(*) AS fase_completa,
    COUNT(*)::INTEGER AS partidos_totales,
    COUNT(*) FILTER (WHERE estado_partido = 'finalizado')::INTEGER AS partidos_finalizados,
    COUNT(*) FILTER (WHERE estado_partido != 'finalizado')::INTEGER AS partidos_pendientes
  FROM partidos
  WHERE jornada_id = jornada_uuid;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_phase_completion IS 'Returns completion status for a given jornada/phase';

-- ============================================================================
-- PART 4: Create trigger to auto-update phase state
-- ============================================================================

CREATE OR REPLACE FUNCTION update_jornada_estado()
RETURNS TRIGGER AS $$
DECLARE
  total_matches INTEGER;
  finished_matches INTEGER;
  in_progress_matches INTEGER;
BEGIN
  -- Count matches in this jornada
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado_partido = 'finalizado'),
    COUNT(*) FILTER (WHERE estado_partido = 'en_curso')
  INTO total_matches, finished_matches, in_progress_matches
  FROM partidos
  WHERE jornada_id = COALESCE(NEW.jornada_id, OLD.jornada_id);

  -- Update jornada estado based on match states
  IF total_matches > 0 THEN
    IF finished_matches = total_matches THEN
      -- All matches finished
      UPDATE jornadas
      SET fase_estado = 'completada'
      WHERE id = COALESCE(NEW.jornada_id, OLD.jornada_id)
        AND fase_estado != 'bloqueada'; -- Don't override manual locks
    ELSIF in_progress_matches > 0 THEN
      -- At least one match in progress
      UPDATE jornadas
      SET fase_estado = 'en_curso'
      WHERE id = COALESCE(NEW.jornada_id, OLD.jornada_id)
        AND fase_estado = 'pendiente';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_jornada_estado ON partidos;
CREATE TRIGGER trigger_update_jornada_estado
AFTER INSERT OR UPDATE OF estado_partido ON partidos
FOR EACH ROW
EXECUTE FUNCTION update_jornada_estado();

COMMENT ON TRIGGER trigger_update_jornada_estado ON partidos IS 'Auto-updates jornada fase_estado when match states change';

-- ============================================================================
-- PART 5: Verification queries
-- ============================================================================

-- Verify new columns exist
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name = 'jornadas' AND column_name = 'fase_estado') = 1,
         'Column jornadas.fase_estado not created';
  
  ASSERT (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name = 'partidos' AND column_name = 'es_partido_ida') = 1,
         'Column partidos.es_partido_ida not created';
  
  RAISE NOTICE 'Migration completed successfully!';
END $$;
