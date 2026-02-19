-- Migration: Delete Match Cascade
-- Purpose: To safely delete a match while handling dependencies, specifically for Group Stage matches that affect Playoffs.

CREATE OR REPLACE FUNCTION delete_match_cascade(p_match_id UUID)
RETURNS JSON AS $$
DECLARE
  v_current_match RECORD;
  v_playoff_matches INT;
  v_affected_jornadas UUID[];
  v_deleted_events INT := 0;
  v_deleted_matches INT := 0;
BEGIN
  -- Get match info
  SELECT 
    p.id, p.torneo_id, p.ronda, t.tipo as torneo_tipo
  INTO v_current_match
  FROM partidos p
  JOIN torneos t ON p.torneo_id = t.id
  WHERE p.id = p_match_id;

  IF v_current_match IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Match not found');
  END IF;

  -- Logic for Groups+Elimination Tournaments (Group Phase Match)
  IF v_current_match.torneo_tipo = 'grupos_eliminacion' AND v_current_match.ronda IS NULL THEN
      -- Check if playoffs exist
      SELECT COUNT(*) INTO v_playoff_matches
      FROM partidos
      WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL;

      IF v_playoff_matches > 0 THEN
          -- Capture Jornadas to clean up (Jornadas containing playoff matches)
          SELECT array_agg(DISTINCT jornada_id) INTO v_affected_jornadas
          FROM partidos
          WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL AND jornada_id IS NOT NULL;

          -- Delete events from playoff matches
          DELETE FROM eventos_partido
          WHERE partido_id IN (
              SELECT id FROM partidos 
              WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL
          );

          -- Delete playoff matches
          DELETE FROM partidos
          WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL;
          GET DIAGNOSTICS v_deleted_matches = ROW_COUNT;

          -- Clean up empty jornadas (if they became empty)
          IF v_affected_jornadas IS NOT NULL THEN
              DELETE FROM jornadas
              WHERE id = ANY(v_affected_jornadas)
              AND NOT EXISTS (SELECT 1 FROM partidos WHERE jornada_id = jornadas.id);
          END IF;
      END IF;
  END IF;

  -- Finally DELETE the requested match
  DELETE FROM partidos WHERE id = p_match_id;

  RETURN json_build_object(
    'success', true, 
    'deleted_playoff_matches', v_deleted_matches,
    'message', 'Match and dependent playoffs deleted successfully'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_match_cascade(UUID) TO authenticated;
