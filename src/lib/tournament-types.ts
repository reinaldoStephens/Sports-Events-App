// Types for Tournament System
export type TipoTorneo = 'liga' | 'eliminacion_simple';
export type Ronda = 'R1' | 'R2' | 'R3' | 'Q' | 'SF' | 'F';
export type EstadoPartido = 'pendiente' | 'en_curso' | 'finalizado';

export interface ConfigLiga {
  double_round?: boolean;
}

export interface ConfigEliminacion {
  use_seeding?: boolean;
}

export type TorneoConfig = ConfigLiga | ConfigEliminacion;

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
