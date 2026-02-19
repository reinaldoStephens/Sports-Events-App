// Types for Tournament System
export type TipoTorneo = 'liga' | 'eliminacion_simple' | 'grupos_eliminacion';
export type Ronda = 'R1' | 'R2' | 'R3' | 'R4' | 'Q' | 'SF' | 'F';
export type EstadoPartido = 'pendiente' | 'en_curso' | 'finalizado';

export interface ConfigLiga {
  double_round?: boolean;
}

export interface ConfigEliminacion {
  use_seeding?: boolean;
}

export interface ConfigGruposEliminacion {
  num_grupos: number;              // 2, 4, 8
  clasificados_por_grupo: number;  // 1 or 2
  double_round?: boolean;          // ida y vuelta in group phase
}

export type TorneoConfig = ConfigLiga | ConfigEliminacion | ConfigGruposEliminacion;

export interface JornadaGenerada {
  numero: number;
  nombre?: string;
  partidos: PartidoGenerado[];
}

export interface PartidoGenerado {
  local: string; // equipo_id
  visitante: string; // equipo_id
  ronda?: Ronda;
  siguiente_partido_index?: number;
}

export interface GenerateFixtureResult {
  success: boolean;
  message: string;
  jornadas_creadas?: number;
  partidos_creados?: number;
  error?: string;
}
