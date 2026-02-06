import type { Database } from './database.types';
import { calculateMatchPoints } from './sport-config';

type Equipo = {
  id: string;
  nombre: string;
  logo_url: string | null;
  escudo_url?: string | null;
};

type Partido = {
  id: string;
  equipo_local_id: string | null;
  equipo_visitante_id: string | null;
  puntos_local: number | null;
  puntos_visitante: number | null;
  estado_partido: 'pendiente' | 'en_curso' | 'finalizado';
};

export type StandingRow = {
  equipo: Equipo;
  pj: number; // Partidos jugados
  g: number;  // Ganados
  e: number;  // Empatados
  p: number;  // Perdidos
  pf: number; // Puntos a favor (generic: goles, sets, puntos, carreras)
  pc: number; // Puntos en contra
  dp: number; // Diferencia de puntos
  pts: number; // Puntos de tabla
};

/**
 * Calculate standings table for a tournament
 * @param equipos - List of teams
 * @param partidos - List of matches
 * @param sportSlug - Sport slug for point calculation (futbol, volleyball, etc.)
 */
export function calculateStandings(
  equipos: Equipo[], 
  partidos: Partido[],
  sportSlug: string = 'futbol'
): StandingRow[] {
  const standingsMap = new Map<string, StandingRow>();

  // Initialize map
  equipos.forEach(equipo => {
    standingsMap.set(equipo.id, {
      equipo,
      pj: 0, g: 0, e: 0, p: 0, pf: 0, pc: 0, dp: 0, pts: 0
    });
  });

  partidos.forEach(partido => {
    if (partido.estado_partido !== 'finalizado' && partido.estado_partido !== 'en_curso') return;
    if (!partido.equipo_local_id || !partido.equipo_visitante_id) return;
    
    // Check if teams exist in map (might be cross-group or errors)
    const local = standingsMap.get(partido.equipo_local_id);
    const visitante = standingsMap.get(partido.equipo_visitante_id);

    if (!local || !visitante) return;

    // Score (safe access with fallback to 0)
    const pl = partido.puntos_local || 0;
    const pv = partido.puntos_visitante || 0;

    // Stats for Local
    local.pj++;
    local.pf += pl;
    local.pc += pv;
    local.dp = local.pf - local.pc;

    // Stats for Visitante
    visitante.pj++;
    visitante.pf += pv;
    visitante.pc += pl;
    visitante.dp = visitante.pf - visitante.pc;

    // Result Logic (sport-aware point calculation)
    const localPoints = calculateMatchPoints(sportSlug, pl, pv);
    const visitantePoints = calculateMatchPoints(sportSlug, pv, pl);

    local.pts += localPoints;
    visitante.pts += visitantePoints;

    // Track wins/draws/losses
    if (pl > pv) {
      local.g++;
      visitante.p++;
    } else if (pv > pl) {
      visitante.g++;
      local.p++;
    } else {
      local.e++;
      visitante.e++;
    }
  });

  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts; // More points first
    if (b.dp !== a.dp) return b.dp - a.dp;     // Better difference
    return b.pf - a.pf;                        // More scored
  });
}
