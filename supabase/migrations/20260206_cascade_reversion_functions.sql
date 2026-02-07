-- Migration: Cascade Reversion Functions for Elimination Tournaments
-- Created: 2026-02-06
-- Purpose: Enable safe result correction with automatic cleanup of dependent matches

-- =====================================================
-- Function 1: Check Match Impact
-- =====================================================
-- Detects all matches that will be affected if we change a match result
-- Returns JSON with affected matches, events count, and impact summary

CREATE OR REPLACE FUNCTION check_match_impact(p_match_id UUID)
RETURNS JSON AS $$
DECLARE
  v_current_match RECORD;
  v_next_match RECORD;
  v_affected_matches JSON[] := '{}';
  v_total_events INT := 0;
  v_current_winner_id UUID;
  v_next_match_id UUID;
  v_match_info JSON;
BEGIN
  -- Get current match details
  SELECT 
    p.id,
    p.equipo_local_id,
    p.equipo_visitante_id,
    p.puntos_local,
    p.puntos_visitante,
    p.siguiente_partido_id,
    p.estado_partido,
    el.nombre as local_nombre,
    ev.nombre as visitante_nombre
  INTO v_current_match
  FROM partidos p
  LEFT JOIN equipos el ON p.equipo_local_id = el.id
  LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
  WHERE p.id = p_match_id;

  -- If match doesn't exist or has no next match, no impact
  IF v_current_match IS NULL OR v_current_match.siguiente_partido_id IS NULL THEN
    RETURN json_build_object(
      'has_impact', false,
      'affected_matches', '[]'::json,
      'total_events', 0
    );
  END IF;

  -- Determine current winner (if match is finalized)
  IF v_current_match.puntos_local IS NOT NULL AND v_current_match.puntos_visitante IS NOT NULL THEN
    IF v_current_match.puntos_local > v_current_match.puntos_visitante THEN
      v_current_winner_id := v_current_match.equipo_local_id;
    ELSIF v_current_match.puntos_visitante > v_current_match.puntos_local THEN
      v_current_winner_id := v_current_match.equipo_visitante_id;
    END IF;
  END IF;

  -- Recursively traverse the chain
  v_next_match_id := v_current_match.siguiente_partido_id;
  
  WHILE v_next_match_id IS NOT NULL LOOP
    -- Get next match details
    SELECT 
      p.id,
      p.equipo_local_id,
      p.equipo_visitante_id,
      p.puntos_local,
      p.puntos_visitante,
      p.siguiente_partido_id,
      p.estado_partido,
      el.nombre as local_nombre,
      ev.nombre as visitante_nombre,
      j.nombre_fase,
      (SELECT COUNT(*) FROM eventos_partido WHERE partido_id = p.id) as events_count
    INTO v_next_match
    FROM partidos p
    LEFT JOIN equipos el ON p.equipo_local_id = el.id
    LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
    LEFT JOIN jornadas j ON p.jornada_id = j.id
    WHERE p.id = v_next_match_id;

    EXIT WHEN v_next_match IS NULL;

    -- Check if current winner is in this match
    IF v_current_winner_id IS NOT NULL AND 
       (v_next_match.equipo_local_id = v_current_winner_id OR 
        v_next_match.equipo_visitante_id = v_current_winner_id) THEN
      
      -- Add to affected matches
      v_match_info := json_build_object(
        'match_id', v_next_match.id,
        'fase', COALESCE(v_next_match.nombre_fase, 'Siguiente Ronda'),
        'local', v_next_match.local_nombre,
        'visitante', v_next_match.visitante_nombre,
        'score_local', v_next_match.puntos_local,
        'score_visitante', v_next_match.puntos_visitante,
        'estado', v_next_match.estado_partido,
        'events_count', v_next_match.events_count
      );
      
      v_affected_matches := array_append(v_affected_matches, v_match_info);
      v_total_events := v_total_events + COALESCE(v_next_match.events_count, 0);
      
      -- Continue to next match in chain
      v_next_match_id := v_next_match.siguiente_partido_id;
    ELSE
      -- Winner not in next match, stop traversal
      EXIT;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'has_impact', array_length(v_affected_matches, 1) > 0,
    'affected_matches', array_to_json(v_affected_matches),
    'total_events', v_total_events,
    'current_winner_id', v_current_winner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function 2: Revert Match with Cascade
-- =====================================================
-- Executes the cascade deletion in a transaction
-- Updates the original match and cleans all dependent matches

CREATE OR REPLACE FUNCTION revert_match_cascade(
  p_match_id UUID,
  p_new_local_score INT,
  p_new_visitor_score INT
)
RETURNS JSON AS $$
DECLARE
  v_current_match RECORD;
  v_old_winner_id UUID;
  v_new_winner_id UUID;
  v_next_match_id UUID;
  v_next_match RECORD;
  v_deleted_events INT := 0;
  v_reset_matches INT := 0;
  v_affected_match_ids UUID[] := '{}';
  v_temp_count INT;
BEGIN
  -- Get current match
  SELECT 
    id,
    equipo_local_id,
    equipo_visitante_id,
    puntos_local,
    puntos_visitante,
    siguiente_partido_id
  INTO v_current_match
  FROM partidos
  WHERE id = p_match_id;

  IF v_current_match IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_current_match.siguiente_partido_id IS NULL THEN
    -- No cascade needed, just update the match
    UPDATE partidos
    SET 
      puntos_local = p_new_local_score,
      puntos_visitante = p_new_visitor_score,
      estado_partido = 'finalizado'
    WHERE id = p_match_id;

    RETURN json_build_object(
      'success', true,
      'deleted_events', 0,
      'reset_matches', 0,
      'message', 'Match updated without cascade'
    );
  END IF;

  -- Determine old winner
  IF v_current_match.puntos_local > v_current_match.puntos_visitante THEN
    v_old_winner_id := v_current_match.equipo_local_id;
  ELSIF v_current_match.puntos_visitante > v_current_match.puntos_local THEN
    v_old_winner_id := v_current_match.equipo_visitante_id;
  END IF;

  -- Determine new winner
  IF p_new_local_score > p_new_visitor_score THEN
    v_new_winner_id := v_current_match.equipo_local_id;
  ELSIF p_new_visitor_score > p_new_local_score THEN
    v_new_winner_id := v_current_match.equipo_visitante_id;
  END IF;

  -- If winner hasn't changed, just update scores
  IF v_old_winner_id = v_new_winner_id THEN
    UPDATE partidos
    SET 
      puntos_local = p_new_local_score,
      puntos_visitante = p_new_visitor_score
    WHERE id = p_match_id;

    RETURN json_build_object(
      'success', true,
      'deleted_events', 0,
      'reset_matches', 0,
      'message', 'Winner unchanged, scores updated'
    );
  END IF;

  -- Winner has changed - cascade cleanup needed
  v_next_match_id := v_current_match.siguiente_partido_id;

  -- Traverse and clean dependent matches
  WHILE v_next_match_id IS NOT NULL LOOP
    SELECT 
      id,
      equipo_local_id,
      equipo_visitante_id,
      siguiente_partido_id
    INTO v_next_match
    FROM partidos
    WHERE id = v_next_match_id;

    EXIT WHEN v_next_match IS NULL;

    -- Check if old winner is in this match
    IF v_old_winner_id IS NOT NULL AND 
       (v_next_match.equipo_local_id = v_old_winner_id OR 
        v_next_match.equipo_visitante_id = v_old_winner_id) THEN
      
      -- Count and delete all events for this match
      SELECT COUNT(*) INTO v_temp_count FROM eventos_partido WHERE partido_id = v_next_match.id;
      v_deleted_events := v_deleted_events + v_temp_count;
      DELETE FROM eventos_partido WHERE partido_id = v_next_match.id;

      -- Reset match state
      UPDATE partidos
      SET 
        puntos_local = NULL,
        puntos_visitante = NULL,
        estado_partido = 'pendiente',
        -- Replace old winner with new winner
        equipo_local_id = CASE 
          WHEN equipo_local_id = v_old_winner_id THEN v_new_winner_id 
          ELSE equipo_local_id 
        END,
        equipo_visitante_id = CASE 
          WHEN equipo_visitante_id = v_old_winner_id THEN v_new_winner_id 
          ELSE equipo_visitante_id 
        END
      WHERE id = v_next_match.id;

      v_reset_matches := v_reset_matches + 1;
      v_affected_match_ids := array_append(v_affected_match_ids, v_next_match.id);

      -- Continue to next match
      v_next_match_id := v_next_match.siguiente_partido_id;
    ELSE
      -- Old winner not in this match, stop
      EXIT;
    END IF;
  END LOOP;

  -- Finally, update the original match with new scores
  UPDATE partidos
  SET 
    puntos_local = p_new_local_score,
    puntos_visitante = p_new_visitor_score,
    estado_partido = 'finalizado'
  WHERE id = p_match_id;

  RETURN json_build_object(
    'success', true,
    'deleted_events', v_deleted_events,
    'reset_matches', v_reset_matches,
    'affected_match_ids', array_to_json(v_affected_match_ids),
    'message', 'Cascade reversion completed successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_match_impact(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION revert_match_cascade(UUID, INT, INT) TO authenticated;
