-- Migration: Cascade Reversion Functions for Elimination Tournaments
-- Created: 2026-02-06
-- Updated: 2026-02-10 (Added Group Phase Cascade Logic)
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
  
  -- Variables for Group Phase Logic
  v_torneo_tipo TEXT;
  v_current_ronda TEXT;
  v_torneo_id UUID;
  v_playoff_matches INT;
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
    p.ronda,
    p.torneo_id,
    t.tipo as torneo_tipo,
    el.nombre as local_nombre,
    ev.nombre as visitante_nombre
  INTO v_current_match
  FROM partidos p
  LEFT JOIN equipos el ON p.equipo_local_id = el.id
  LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
  JOIN torneos t ON p.torneo_id = t.id
  WHERE p.id = p_match_id;

  -- If match doesn't exist, return empty
  IF v_current_match IS NULL THEN
    RETURN json_build_object(
      'has_impact', false,
      'affected_matches', '[]'::json,
      'total_events', 0
    );
  END IF;

  -- =====================================================
  -- SPECIAL LOGIC: Group Phase in Groups+Playoff Tournament
  -- =====================================================
  IF v_current_match.torneo_tipo = 'grupos_eliminacion' AND v_current_match.ronda IS NULL THEN
      -- Check if any Playoff Matches exist (ronda IS NOT NULL)
      -- We want to return THESE as the affected matches
      
      -- Calculate total events in playoffs
      SELECT COUNT(*) INTO v_total_events
      FROM eventos_partido
      WHERE partido_id IN (
          SELECT id FROM partidos 
          WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL
      );
      
      -- Get list of affected matches (ALL playoff matches)
      SELECT json_agg(json_build_object(
        'match_id', p.id,
        'fase', COALESCE(j.nombre_fase, p.ronda),
        'local', el.nombre,
        'visitante', ev.nombre,
        'score_local', p.puntos_local,
        'score_visitante', p.puntos_visitante,
        'estado', p.estado_partido,
        'events_count', (SELECT COUNT(*) FROM eventos_partido WHERE partido_id = p.id)
      ))
      INTO v_match_info -- using v_match_info to store the array temporarily or just assign to v_affected_matches directly if type matches
      FROM partidos p
      LEFT JOIN equipos el ON p.equipo_local_id = el.id
      LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN jornadas j ON p.jornada_id = j.id
      WHERE p.torneo_id = v_current_match.torneo_id AND p.ronda IS NOT NULL;
      
      -- Cast the JSON array to the expected variable if needed, or just use it in the build_object
      -- v_affected_matches is defined as JSON[], but json_agg returns JSON.
      -- Let's parse it back to array or just handle it. 
      -- Actually, `v_affected_matches` is `JSON[]`. `json_agg` returns `JSON`.
      -- The return object expects `affected_matches` as `JSON` (array_to_json result).
      -- So we can just use the result of json_agg directly in the return.

      IF v_match_info IS NOT NULL THEN
           -- json_agg returns a JSON array. 
           RETURN json_build_object(
              'has_impact', true,
              'affected_matches', v_match_info, 
              'total_events', v_total_events,
              'impact_message', '⚠️ WARNING: This is a Group Stage match. Changing the result will RESET the entire Playoff Phase (' || json_array_length(v_match_info) || ' matches will be deleted). You will need to regenerate the playoffs.'
            );
      END IF;
      
      -- If no playoffs yet, no impact (safe to edit)
      RETURN json_build_object(
        'has_impact', false,
        'affected_matches', '[]'::json,
        'total_events', 0
      );
  END IF;

  -- =====================================================
  -- STANDARD LOGIC: Linked Matches (Elimination Chain)
  -- =====================================================

  -- If no next match linkage, no impact
  IF v_current_match.siguiente_partido_id IS NULL THEN
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
    'current_winner_id', v_current_winner_id,
    'impact_message', NULL
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
  
  -- Group Logic Variables
  v_playoff_matches INT;
  v_affected_jornadas UUID[];
BEGIN
  -- Get current match
  SELECT 
    p.id,
    p.equipo_local_id,
    p.equipo_visitante_id,
    p.puntos_local,
    p.puntos_visitante,
    p.siguiente_partido_id,
    p.ronda,
    p.torneo_id,
    t.tipo as torneo_tipo
  INTO v_current_match
  FROM partidos p
  JOIN torneos t ON p.torneo_id = t.id
  WHERE p.id = p_match_id;

  IF v_current_match IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- =====================================================
  -- SPECIAL LOGIC: Group Phase in Groups+Playoff Tournament
  -- =====================================================
  IF v_current_match.torneo_tipo = 'grupos_eliminacion' AND v_current_match.ronda IS NULL THEN
      -- Check if playoffs exist
      SELECT COUNT(*) INTO v_playoff_matches
      FROM partidos
      WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL;

      IF v_playoff_matches > 0 THEN
          -- 0. Capture Jornadas to check for cleanup later
          SELECT array_agg(DISTINCT jornada_id) INTO v_affected_jornadas
          FROM partidos
          WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL AND jornada_id IS NOT NULL;

          -- 1. Delete events for all playoff matches
          DELETE FROM eventos_partido
          WHERE partido_id IN (
              SELECT id FROM partidos 
              WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL
          );

          -- 2. Delete all playoff matches
          DELETE FROM partidos
          WHERE torneo_id = v_current_match.torneo_id AND ronda IS NOT NULL;

          -- 2.5 Clean up empty jornadas
          IF v_affected_jornadas IS NOT NULL THEN
              DELETE FROM jornadas
              WHERE id = ANY(v_affected_jornadas)
              AND NOT EXISTS (SELECT 1 FROM partidos WHERE jornada_id = jornadas.id);
          END IF;

          v_reset_matches := v_playoff_matches;

          -- 3. Update the group match with new score
          UPDATE partidos
          SET 
            puntos_local = p_new_local_score,
            puntos_visitante = p_new_visitor_score,
            estado_partido = 'finalizado'
          WHERE id = p_match_id;

          RETURN json_build_object(
            'success', true,
            'deleted_events', 0, 
            'reset_matches', v_reset_matches,
            'affected_match_ids', '[]'::json,
            'message', 'Playoff phase reset. Group match updated successfully.'
          );
      END IF;
  END IF;

  -- =====================================================
  -- STANDARD LOGIC: Linked Matches
  -- =====================================================

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
