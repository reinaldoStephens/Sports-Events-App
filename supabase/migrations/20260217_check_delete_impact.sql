-- Migration: Check Delete Impact Function
-- Created: 2026-02-17
-- Purpose: Detect dependent/affected matches before deleting matches or jornadas

CREATE OR REPLACE FUNCTION check_delete_impact(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_affected_matches JSON[] := '{}';
  v_total_events INT := 0;
  v_has_impact BOOLEAN := false;
  v_match_info JSON;
  v_message TEXT := '';
  v_current_match RECORD;
  v_fed_by_matches INT := 0;
  v_jornada_matches RECORD;
BEGIN
  -- =====================================================
  -- MATCH DELETION CHECK
  -- =====================================================
  IF p_entity_type = 'match' THEN
    -- Get match details
    SELECT 
      p.id,
      p.equipo_local_id,
      p.equipo_visitante_id,
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
    WHERE p.id = p_entity_id;

    IF v_current_match IS NULL THEN
      RETURN json_build_object(
        'has_impact', false,
        'affected_matches', '[]'::json,
        'total_events', 0,
        'message', 'Match not found'
      );
    END IF;

    -- Check 1: Does this match feed into another match?
    IF v_current_match.siguiente_partido_id IS NOT NULL THEN
      v_has_impact := true;
      
      -- Get the next match details
      SELECT json_build_object(
        'match_id', p.id,
        'fase', COALESCE(j.nombre_fase, p.ronda, 'Siguiente Ronda'),
        'local', el.nombre,
        'visitante', ev.nombre,
        'score_local', p.puntos_local,
        'score_visitante', p.puntos_visitante,
        'estado', p.estado_partido,
        'events_count', (SELECT COUNT(*) FROM eventos_partido WHERE partido_id = p.id)
      )
      INTO v_match_info
      FROM partidos p
      LEFT JOIN equipos el ON p.equipo_local_id = el.id
      LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN jornadas j ON p.jornada_id = j.id
      WHERE p.id = v_current_match.siguiente_partido_id;

      IF v_match_info IS NOT NULL THEN
        v_affected_matches := array_append(v_affected_matches, v_match_info);
        v_message := '⚠️ This match feeds into a subsequent match. Deleting it will break the bracket chain.';
      END IF;
    END IF;

    -- Check 2: Are other matches feeding INTO this match?
    SELECT COUNT(*) INTO v_fed_by_matches
    FROM partidos
    WHERE siguiente_partido_id = p_entity_id;

    IF v_fed_by_matches > 0 THEN
      v_has_impact := true;
      IF v_message != '' THEN
        v_message := v_message || ' Also, ' || v_fed_by_matches || ' match(es) feed into this one - they will become orphaned.';
      ELSE
        v_message := '⚠️ ' || v_fed_by_matches || ' match(es) feed into this one. Deleting will orphan those matches.';
      END IF;
    END IF;

    -- Count events in the match being deleted
    SELECT COUNT(*) INTO v_total_events
    FROM eventos_partido
    WHERE partido_id = p_entity_id;

    RETURN json_build_object(
      'has_impact', v_has_impact,
      'affected_matches', array_to_json(v_affected_matches),
      'total_events', v_total_events,
      'message', v_message
    );

  -- =====================================================
  -- JORNADA DELETION CHECK
  -- =====================================================
  ELSIF p_entity_type = 'jornada' THEN
    -- Get all matches in this jornada
    FOR v_jornada_matches IN
      SELECT 
        p.id as match_id,
        p.siguiente_partido_id,
        el.nombre as local_nombre,
        ev.nombre as visitante_nombre,
        p.estado_partido,
        p.puntos_local,
        p.puntos_visitante
      FROM partidos p
      LEFT JOIN equipos el ON p.equipo_local_id = el.id
      LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
      WHERE p.jornada_id = p_entity_id
    LOOP
      -- For each match, check if it has a siguiente_partido_id
      IF v_jornada_matches.siguiente_partido_id IS NOT NULL THEN
        v_has_impact := true;
        
        -- Add to affected matches
        SELECT json_build_object(
          'match_id', p.id,
          'fase', COALESCE(j.nombre_fase, p.ronda, 'Siguiente Ronda'),
          'local', el.nombre,
          'visitante', ev.nombre,
          'score_local', p.puntos_local,
          'score_visitante', p.puntos_visitante,
          'estado', p.estado_partido,
          'events_count', (SELECT COUNT(*) FROM eventos_partido WHERE partido_id = p.id)
        )
        INTO v_match_info
        FROM partidos p
        LEFT JOIN equipos el ON p.equipo_local_id = el.id
        LEFT JOIN equipos ev ON p.equipo_visitante_id = ev.id
        LEFT JOIN jornadas j ON p.jornada_id = j.id
        WHERE p.id = v_jornada_matches.siguiente_partido_id;

        IF v_match_info IS NOT NULL AND NOT (v_match_info = ANY(v_affected_matches)) THEN
          v_affected_matches := array_append(v_affected_matches, v_match_info);
        END IF;
      END IF;
    END LOOP;

    -- Count total events across all matches in this jornada
    SELECT COUNT(*) INTO v_total_events
    FROM eventos_partido
    WHERE partido_id IN (SELECT id FROM partidos WHERE jornada_id = p_entity_id);

    IF v_has_impact THEN
      v_message := '⚠️ This jornada contains matches that feed into subsequent rounds. Deleting will break the bracket structure.';
    END IF;

    RETURN json_build_object(
      'has_impact', v_has_impact,
      'affected_matches', array_to_json(v_affected_matches),
      'total_events', v_total_events,
      'message', v_message
    );

  ELSE
    RETURN json_build_object(
      'has_impact', false,
      'affected_matches', '[]'::json,
      'total_events', 0,
      'message', 'Invalid entity type'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_delete_impact(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION check_delete_impact IS 'Checks the impact of deleting a match or jornada, returning affected matches and event counts';
