DO $$
DECLARE
  v_deporte_id UUID := '9e065e9c-4352-4b96-8391-54088393b2f6'; -- Futbol ID
  v_torneo_id UUID;
  v_jornada_id UUID;
  v_t1 UUID; v_t2 UUID; v_t3 UUID; v_t4 UUID;
BEGIN
  -- 1. Create Tournament
  INSERT INTO torneos (nombre, deporte_id, tipo, estado, config, fecha_inicio, fecha_fin)
  VALUES (
    'Auto Test Playoff ' || NOW(), 
    v_deporte_id,
    'grupos_eliminacion', 
    'activo', 
    '{
      "tipo_torneo": "grupos_eliminacion",
      "puntos_ganar": 3,
      "puntos_empatar": 1,
      "puntos_perder": 0,
      "playoff_config": {
        "ida_y_vuelta": true,
        "usa_gol_visitante": true,
        "tercer_lugar": false
      }
    }',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month'
  )
  RETURNING id INTO v_torneo_id;

  -- 2. Create Teams
  INSERT INTO equipos (nombre, deporte_id) VALUES ('Test Team A', v_deporte_id) RETURNING id INTO v_t1;
  INSERT INTO equipos (nombre, deporte_id) VALUES ('Test Team B', v_deporte_id) RETURNING id INTO v_t2;
  INSERT INTO equipos (nombre, deporte_id) VALUES ('Test Team C', v_deporte_id) RETURNING id INTO v_t3;
  INSERT INTO equipos (nombre, deporte_id) VALUES ('Test Team D', v_deporte_id) RETURNING id INTO v_t4;

  -- 3. Register Teams with Group Assignment (Using 'A' for all)
  INSERT INTO torneo_participantes (torneo_id, equipo_id, status, grupo) 
  VALUES 
    (v_torneo_id, v_t1, 'aprobado', 'A'), 
    (v_torneo_id, v_t2, 'aprobado', 'A'), 
    (v_torneo_id, v_t3, 'aprobado', 'A'), 
    (v_torneo_id, v_t4, 'aprobado', 'A');

  -- 4. Create Jornada (Shared for the group phase)
  INSERT INTO jornadas (nombre_fase, numero_jornada, torneo_id, fase_tipo, fase_estado) 
  VALUES ('Fase de Grupos - Jornada 1', 1, v_torneo_id, 'group', 'completada') 
  RETURNING id INTO v_jornada_id;

  -- 5. Create Matches (Finalized)
  -- Match 1: A vs B (3-0)
  INSERT INTO partidos (jornada_id, torneo_id, equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante, estado_partido)
  VALUES (v_jornada_id, v_torneo_id, v_t1, v_t2, 3, 0, 'finalizado');

  -- Match 2: C vs D (2-0)
  INSERT INTO partidos (jornada_id, torneo_id, equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante, estado_partido)
  VALUES (v_jornada_id, v_torneo_id, v_t3, v_t4, 2, 0, 'finalizado');
  
END $$;
