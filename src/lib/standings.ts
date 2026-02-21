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
  penales_jugados?: boolean | null;
  penales_local?: number | null;
  penales_visitante?: number | null;
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
    // Track wins/draws/losses and Points
    let localWin = pl > pv;
    let visitanteWin = pv > pl;
    let isDraw = pl === pv;

    // Handle Penalty Shootout if Draw
    if (isDraw && partido.penales_jugados && 
        typeof partido.penales_local === 'number' && 
        typeof partido.penales_visitante === 'number') {
      
      const pLocal = partido.penales_local;
      const pVisitante = partido.penales_visitante;

      if (pLocal > pVisitante) {
        localWin = true;
        visitanteWin = false;
        isDraw = false;
      } else if (pVisitante > pLocal) {
        visitanteWin = true;
        localWin = false;
        isDraw = false;
      }
    }

    if (localWin) {
      local.g++;
      visitante.p++;
      local.pts += 3; // Win = 3 pts
    } else if (visitanteWin) {
      visitante.g++;
      local.p++;
      visitante.pts += 3; // Win = 3 pts
    } else {
      local.e++;
      visitante.e++;
      local.pts += 1; // Draw = 1 pt
      visitante.pts += 1;
    }
  });

  // Sort by Points first to group them
  const initialSort = Array.from(standingsMap.values()).sort((a, b) => b.pts - a.pts);

  return resolveTies(initialSort, partidos);
}

/**
 * Recursive function to resolve ties
 */
function resolveTies(rows: StandingRow[], allMatches: Partido[]): StandingRow[] {
    if (rows.length <= 1) return rows;

    // 1. DUELO DIRECTO (H2H) Calculation for the CURRENT set of teams
    // Filter matches that involve ONLY teams within this group
    const teamIds = new Set(rows.map(r => r.equipo.id));
    const h2hMatches = allMatches.filter(m => 
        m.equipo_local_id && teamIds.has(m.equipo_local_id) &&
        m.equipo_visitante_id && teamIds.has(m.equipo_visitante_id) &&
        (m.estado_partido === 'finalizado' || m.estado_partido === 'en_curso')
    );

    // Calculate Mini-League Stats
    const h2hStats = new Map<string, { pts: number, dp: number, gf: number }>();
    rows.forEach(r => h2hStats.set(r.equipo.id, { pts: 0, dp: 0, gf: 0 }));

    h2hMatches.forEach(m => {
        const localId = m.equipo_local_id!;
        const visitorId = m.equipo_visitante_id!;
        const goalsLocal = m.puntos_local || 0;
        const goalsVisitor = m.puntos_visitante || 0;

        const statL = h2hStats.get(localId)!;
        const statV = h2hStats.get(visitorId)!;

        statL.gf += goalsLocal;
        statV.gf += goalsVisitor;
        statL.dp += (goalsLocal - goalsVisitor);
        statV.dp += (goalsVisitor - goalsLocal);

        if (goalsLocal > goalsVisitor) {
            statL.pts += 3;
        } else if (goalsVisitor > goalsLocal) {
            statV.pts += 3;
        } else {
            statL.pts += 1;
            statV.pts += 1;
        }
    });

    // Sort by H2H Criteria to create subgroups
    const sortedByH2H = [...rows].sort((a, b) => {
        const statA = h2hStats.get(a.equipo.id)!;
        const statB = h2hStats.get(b.equipo.id)!;
        if (statB.pts !== statA.pts) return statB.pts - statA.pts;
        if (statB.dp !== statA.dp) return statB.dp - statA.dp;
        if (statB.gf !== statA.gf) return statB.gf - statA.gf;
        return 0;
    });

    // Group by Identical H2H Stats
    const subgroups: StandingRow[][] = [];
    let currentSubgroup: StandingRow[] = [sortedByH2H[0]];

    for (let i = 1; i < sortedByH2H.length; i++) {
        const prev = sortedByH2H[i-1];
        const curr = sortedByH2H[i];
        const statPrev = h2hStats.get(prev.equipo.id)!;
        const statCurr = h2hStats.get(curr.equipo.id)!;

        const isTiedH2H = 
            statPrev.pts === statCurr.pts &&
            statPrev.dp === statCurr.dp &&
            statPrev.gf === statCurr.gf;

        if (isTiedH2H) {
            currentSubgroup.push(curr);
        } else {
            subgroups.push(currentSubgroup);
            currentSubgroup = [curr];
        }
    }
    subgroups.push(currentSubgroup);

    // Process Subgroups
    const finalOrder: StandingRow[] = [];
    
    for (const subgroup of subgroups) {
        if (subgroup.length === 1) {
            // Uniquely identified by H2H
            finalOrder.push(subgroup[0]);
        } else if (subgroup.length < rows.length) {
            // STRICTLY SMALLER SUBGROUP -> RECURSE
            // The context changes (fewer teams), so H2H stats might change.
            finalOrder.push(...resolveTies(subgroup, allMatches));
        } else {
            // subgroup is same size as rows -> H2H DID NOT HELP (All tied or circular identical)
            // Fallback to General Stats
            subgroup.sort((a, b) => {
                if (b.dp !== a.dp) return b.dp - a.dp; // General DP
                if (b.pf !== a.pf) return b.pf - a.pf; // General GF
                return 0; // Truly tied (Sorteo)
            });
            finalOrder.push(...subgroup);
        }
    }

    return finalOrder;
}

// Remove applyTieBreakers helper as it is integrated


