import type { SupabaseClient } from '@supabase/supabase-js';

export async function getTournamentChampion(supabase: SupabaseClient<any>, torneoId: string, tipo: string) {
  try {
    if (tipo === 'liga') {
      // Compute the champion directly from finalized match results.
      // We avoid tabla_posiciones_view here because it filters by status='aprobado' in torneo_participantes,
      // which would exclude tournaments where participation status is 'pendiente'.
      const { data: matchRows, error } = await supabase
        .from('partidos')
        .select(`
          equipo_local_id,
          equipo_visitante_id,
          puntos_local,
          puntos_visitante,
          local:equipos!partidos_equipo_local_id_fkey(id, nombre, logo_url),
          visita:equipos!partidos_equipo_visitante_id_fkey(id, nombre, logo_url),
          jornada:jornadas!inner(torneo_id)
        `)
        .eq('jornada.torneo_id', torneoId)
        .eq('estado_partido', 'finalizado')
        .not('equipo_local_id', 'is', null)
        .not('equipo_visitante_id', 'is', null);

      if (error || !matchRows || matchRows.length === 0) return null;

      // Tally points per team (3 for win, 1 for draw, 0 for loss) and goal difference
      const teamStats: Record<string, { pts: number; dg: number; gf: number; team: any }> = {};

      const ensureTeam = (teamId: string, teamObj: any) => {
        if (!teamStats[teamId]) {
          teamStats[teamId] = { pts: 0, dg: 0, gf: 0, team: teamObj };
        }
      };

      for (const m of matchRows) {
        const localId = m.equipo_local_id as string;
        const visitaId = m.equipo_visitante_id as string;
        const gLocal = m.puntos_local ?? 0;
        const gVisita = m.puntos_visitante ?? 0;
        const localTeam = Array.isArray(m.local) ? m.local[0] : m.local;
        const visitaTeam = Array.isArray(m.visita) ? m.visita[0] : m.visita;

        ensureTeam(localId, localTeam);
        ensureTeam(visitaId, visitaTeam);

        teamStats[localId].gf += gLocal;
        teamStats[localId].dg += gLocal - gVisita;
        teamStats[visitaId].gf += gVisita;
        teamStats[visitaId].dg += gVisita - gLocal;

        if (gLocal > gVisita) {
          teamStats[localId].pts += 3;
        } else if (gVisita > gLocal) {
          teamStats[visitaId].pts += 3;
        } else {
          teamStats[localId].pts += 1;
          teamStats[visitaId].pts += 1;
        }
      }

      const sorted = Object.values(teamStats).sort((a, b) =>
        b.pts - a.pts || b.dg - a.dg || b.gf - a.gf
      );

      if (sorted.length === 0 || !sorted[0].team) return null;
      const winner = sorted[0].team;
      return { id: winner.id, nombre: winner.nombre, logo_url: winner.logo_url ?? null };
    } else {
      // For elimination styles, find the final match
      // First, get the 'F' or 'final' phase match
      const { data: finalMatches, error } = await supabase
        .from('partidos')
        .select(`
          id,
          equipo_local_id,
          equipo_visitante_id,
          puntos_local,
          puntos_visitante,
          penales_local,
          penales_visitante,
          estado_partido,
          local:equipos!partidos_equipo_local_id_fkey(id, nombre, logo_url),
          visita:equipos!partidos_equipo_visitante_id_fkey(id, nombre, logo_url)
        `)
        .eq('torneo_id', torneoId)
        .in('ronda', ['F', 'final', 'Final'])
        .eq('estado_partido', 'finalizado');
        
      if (error || !finalMatches || finalMatches.length === 0) return null;

      // Handle potentially two-legged finals, we find the aggregate or the deciding match.
      // Usually, there is one match. If two, we might sum them. 
      // Let's assume the simplest case: a single final match or the second leg of a two-legged tie.
      // Easiest is to sum goals if there are multiple final matches (ida y vuelta).
      if (finalMatches.length === 1) {
        const match = finalMatches[0];
        const localScore = (match.puntos_local || 0) + (match.penales_local || 0);
        const awayScore = (match.puntos_visitante || 0) + (match.penales_visitante || 0);
        
        if (localScore > awayScore) {
          return Array.isArray(match.local) ? match.local[0] : match.local;
        } else if (awayScore > localScore) {
          return Array.isArray(match.visita) ? match.visita[0] : match.visita;
        }
      } else if (finalMatches.length > 1) {
         // Aggregate the score for two legs
         const aggLocal = finalMatches.reduce((acc, m) => acc + (m.puntos_local || 0), 0) + (finalMatches[finalMatches.length - 1].penales_local || 0);
         const aggAway = finalMatches.reduce((acc, m) => acc + (m.puntos_visitante || 0), 0) + (finalMatches[finalMatches.length - 1].penales_visitante || 0);
         
         const firstMatch = finalMatches[0];
         if (aggLocal > aggAway) {
            return Array.isArray(firstMatch.local) ? firstMatch.local[0] : firstMatch.local;
         } else if (aggAway > aggLocal) {
            return Array.isArray(firstMatch.visita) ? firstMatch.visita[0] : firstMatch.visita;
         }
      }
      return null;
    }
  } catch (e) {
    console.error(`Error fetching champion for ${torneoId}`, e);
    return null;
  }
}
