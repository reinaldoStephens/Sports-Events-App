import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { Ronda, GenerateFixtureResult } from '../lib/tournament-types';
import { calculateStandings } from '../lib/standings';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

interface BracketPartido {
  local: string;
  visitante: string;
  ronda: Ronda;
  siguiente_partido_index?: number;
}

/**
 * Generates the playoff phase from completed group stage results.
 * 1. Verifies all group phase matches are finalized
 * 2. Calculates standings per group
 * 3. Selects qualified teams (top N per group)
 * 4. Creates crossed bracket (1st Group A vs 2nd Group B, etc.)
 * 5. Generates single-elimination bracket
 * 6. Inserts playoff jornadas and matches
 */
export const generatePlayoffFromGroupsHandler = async ({
  torneoId,
}: {
  torneoId: string;
}): Promise<GenerateFixtureResult> => {
  console.log('🟦 [PlayoffFromGroups] Handler called for:', torneoId);
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Verify tournament exists and is grupos_eliminacion
    const { data: torneo, error: torneoError } = await supabase
      .from('torneos')
      .select('id, nombre, tipo, config')
      .eq('id', torneoId)
      .single();

    if (torneoError || !torneo) {
      return { success: false, message: 'Torneo no encontrado', error: torneoError?.message };
    }

    if (torneo.tipo !== 'grupos_eliminacion') {
      return { success: false, message: 'Este torneo no es de tipo Grupos + Playoff' };
    }

    const config = (torneo.config || {}) as { num_grupos?: number; clasificados_por_grupo?: number };
    const clasificadosPorGrupo = config.clasificados_por_grupo || 2;

    // 2. Check that playoff hasn't already been generated
    // Playoff jornadas have ronda set on their matches
    const { data: existingPlayoffMatches } = await supabase
      .from('partidos')
      .select('id')
      .eq('torneo_id', torneoId)
      .not('ronda', 'is', null)
      .limit(1);

    if (existingPlayoffMatches && existingPlayoffMatches.length > 0) {
      return {
        success: false,
        message: 'La fase de playoff ya ha sido generada. Elimina las jornadas de playoff antes de regenerar.',
      };
    }

    // 3. Get all group phase matches and verify they're all finalized
    const { data: allGroupMatches, error: matchesError } = await supabase
      .from('partidos')
      .select('id, equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante, estado_partido, jornada_id, penales_jugados, penales_local, penales_visitante')
      .eq('torneo_id', torneoId)
      .is('ronda', null); // Group phase matches have no ronda

    if (matchesError) {
      return { success: false, message: 'Error al obtener partidos de fase de grupos', error: matchesError.message };
    }

    if (!allGroupMatches || allGroupMatches.length === 0) {
      return { success: false, message: 'No hay partidos de fase de grupos registrados.' };
    }

    const pendingMatches = allGroupMatches.filter(m => m.estado_partido !== 'finalizado');
    if (pendingMatches.length > 0) {
      return {
        success: false,
        message: `Aún hay ${pendingMatches.length} partido(s) de fase de grupos sin finalizar. Todos los partidos deben estar finalizados para generar el playoff.`,
      };
    }

    // 4. Get participants with group assignments
    const { data: participantes, error: partError } = await supabase
      .from('torneo_participantes')
      .select('equipo_id, grupo')
      .eq('torneo_id', torneoId)
      .not('grupo', 'is', null);

    if (partError || !participantes || participantes.length === 0) {
      return { success: false, message: 'No se encontraron equipos con grupos asignados.', error: partError?.message };
    }

    // 5. Get team details
    const teamIds = participantes.map(p => p.equipo_id).filter((id): id is string => id !== null);
    const { data: equipos, error: equiposError } = await supabase
      .from('equipos')
      .select('id, nombre, logo_url, escudo_url')
      .in('id', teamIds);

    if (equiposError || !equipos) {
      return { success: false, message: 'Error al obtener datos de equipos', error: equiposError?.message };
    }

    // 6. Group teams by group name
    const groupsMap = new Map<string, string[]>();
    participantes.forEach(p => {
      const grupo = p.grupo as string;
      if (!groupsMap.has(grupo)) {
        groupsMap.set(grupo, []);
      }
      if (p.equipo_id) groupsMap.get(grupo)!.push(p.equipo_id);
    });

    // 7. Calculate standings per group and select qualifiers
    const sortedGroupNames = Array.from(groupsMap.keys()).sort();
    const qualifiedTeams: { equipoId: string; grupo: string; position: number }[] = [];

    for (const groupName of sortedGroupNames) {
      const groupTeamIds = groupsMap.get(groupName)!;
      const groupEquipos = equipos.filter(e => groupTeamIds.includes(e.id));

      // Filter matches for this group only (both teams must be in the group)
      const groupMatches = allGroupMatches.filter(
        m => m.equipo_local_id && m.equipo_visitante_id &&
          groupTeamIds.includes(m.equipo_local_id) &&
          groupTeamIds.includes(m.equipo_visitante_id)
      ) as any[]; // Cast to any to avoid strict type mismatch with Partido interface

      const standings = calculateStandings(groupEquipos, groupMatches);
      console.log(`🟦 [PlayoffFromGroups] Group ${groupName} standings:`, standings.map(s => `${s.equipo.nombre} (${s.pts}pts)`));

      // Select top N
      for (let i = 0; i < clasificadosPorGrupo && i < standings.length; i++) {
        qualifiedTeams.push({
          equipoId: standings[i].equipo.id,
          grupo: groupName,
          position: i + 1,
        });
      }
    }

    console.log('🟦 [PlayoffFromGroups] Qualified teams:', qualifiedTeams.map(q => `${q.grupo}${q.position}`));

    // 8. Validate power of 2 for bracket
    const totalQualified = qualifiedTeams.length;
    if (totalQualified < 2 || (totalQualified & (totalQualified - 1)) !== 0) {
      return {
        success: false,
        message: `El total de clasificados (${totalQualified}) debe ser potencia de 2. Verifica la configuración.`,
      };
    }

    // 9. Arrange bracket with cross-group seeding
    // Pattern: 1st of Group A vs 2nd of Group B (last), 1st of Group B vs 2nd of Group A, etc.
    const bracketOrder = arrangeCrossGroupSeeding(qualifiedTeams, sortedGroupNames, clasificadosPorGrupo);
    console.log('🟦 [PlayoffFromGroups] Bracket order:', bracketOrder.map(id => {
      const q = qualifiedTeams.find(t => t.equipoId === id);
      return q ? `${q.grupo}${q.position}` : id;
    }));

    // 10. Generate single-elimination bracket
    const bracket = generateBracket(bracketOrder);

    // 11. Group by round
    const roundsMap = new Map<string, BracketPartido[]>();
    bracket.forEach(p => {
      if (!roundsMap.has(p.ronda)) roundsMap.set(p.ronda, []);
      roundsMap.get(p.ronda)!.push(p);
    });

    const roundOrder = ['R1', 'R2', 'R3', 'R4', 'Q', 'SF', 'F'];
    const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) =>
      roundOrder.indexOf(a) - roundOrder.indexOf(b)
    );

    // 12. Get max jornada number for continuation
    const { data: maxJornada } = await supabase
      .from('jornadas')
      .select('numero_jornada')
      .eq('torneo_id', torneoId)
      .order('numero_jornada', { ascending: false })
      .limit(1)
      .single();

    let jornadaNumero = (maxJornada?.numero_jornada || 0) + 1;

    // 13. Insert playoff jornadas and matches
    const partidosCreados: { id: string; ronda: string; originalIndex: number }[] = [];
    let jornadasCreadasCount = 0;

    for (const rondaName of sortedRounds) {
      const matchesInRound = roundsMap.get(rondaName) || [];
      if (matchesInRound.length === 0) continue;

      let nombreJornada = `Ronda ${rondaName}`;
      let faseTipo = 'other';
      if (rondaName === 'Q') {
        nombreJornada = 'Cuartos de Final';
        faseTipo = 'quarterfinals';
      }
      if (rondaName === 'SF') {
        nombreJornada = 'Semifinales';
        faseTipo = 'semifinals';
      }
      if (rondaName === 'F') {
        nombreJornada = 'Gran Final';
        faseTipo = 'final';
      }

      // Check if this phase should use two-legged format
      const { shouldUseTwoLegs } = await import('../utils/playoff-helpers');
      const useTwoLegs = shouldUseTwoLegs(config, faseTipo);

      const { data: jornada, error: jornadaError } = await supabase
        .from('jornadas')
        .insert({
          torneo_id: torneoId,
          numero_jornada: jornadaNumero,
          nombre_fase: nombreJornada,
          fase_tipo: faseTipo,
          es_ida_vuelta: useTwoLegs,
          max_partidos: useTwoLegs ? matchesInRound.length * 2 : matchesInRound.length,
        })
        .select('id')
        .single();

      if (jornadaError || !jornada) {
        throw new Error(`Error al crear jornada ${nombreJornada}: ${jornadaError?.message}`);
      }

      jornadasCreadasCount++;
      jornadaNumero++;

      // Create matches based on format (single or two-legged)
      if (useTwoLegs) {
        // TWO-LEGGED FORMAT
        const { createTwoLeggedTie } = await import('../utils/playoff-helpers');
        
        for (const match of matchesInRound) {
          const result = await createTwoLeggedTie(supabase, {
            torneoId,
            jornadaId: jornada.id,
            equipoLocal: match.local === 'TBD' || !match.local ? '' : match.local,
            equipoVisitante: match.visitante === 'TBD' || !match.visitante ? '' : match.visitante,
            ronda: match.ronda,
            siguientePartidoId: null,
          });

          if (result) {
            const originalIndex = bracket.indexOf(match);
            // Store both matches
            partidosCreados.push({ id: result.partidoIdaId, ronda: match.ronda!, originalIndex });
            partidosCreados.push({ id: result.partidoVueltaId, ronda: match.ronda!, originalIndex });
          }
        }
      } else {
        // SINGLE MATCH FORMAT (original logic)
        const partidosToInsert = matchesInRound.map(match => ({
          jornada_id: jornada.id,
          torneo_id: torneoId,
          equipo_local_id: match.local === 'TBD' ? null : match.local,
          equipo_visitante_id: match.visitante === 'TBD' ? null : match.visitante,
          ronda: match.ronda,
          estado_partido: 'pendiente' as const,
        }));

        const { data: insertedMatches, error: matchesError } = await supabase
          .from('partidos')
          .insert(partidosToInsert)
          .select('id, ronda');

        if (matchesError || !insertedMatches) {
          throw new Error(`Error al crear partidos para ${nombreJornada}: ${matchesError?.message}`);
        }

        insertedMatches.forEach((m, idx) => {
          const originalMatchObj = matchesInRound[idx];
          const originalIndex = bracket.indexOf(originalMatchObj);
          partidosCreados.push({ id: m.id, ronda: m.ronda!, originalIndex });
        });
      }
    }

    // 14. Update siguiente_partido_id links
    const partidoIdMap = new Map<number, string>();
    partidosCreados.forEach(p => partidoIdMap.set(p.originalIndex, p.id));

    for (let i = 0; i < bracket.length; i++) {
      const partido = bracket[i];
      if (partido.siguiente_partido_index !== undefined) {
        const siguienteId = partidoIdMap.get(partido.siguiente_partido_index);
        const partidoId = partidoIdMap.get(i);
        if (siguienteId && partidoId) {
          await supabase
            .from('partidos')
            .update({ siguiente_partido_id: siguienteId })
            .eq('id', partidoId);
        }
      }
    }

    const successMessage = `Playoff generado: ${partidosCreados.length} partidos en ${jornadasCreadasCount} rondas.`;
    console.log('🟢 [PlayoffFromGroups] Success:', successMessage);

    return {
      success: true,
      message: successMessage,
      jornadas_creadas: jornadasCreadasCount,
      partidos_creados: partidosCreados.length,
    };

  } catch (error) {
    console.error('🔴 [PlayoffFromGroups] Exception:', error);
    return {
      success: false,
      message: `Error al generar playoff: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const generatePlayoffFromGroups = defineAction({
  input: z.object({
    torneoId: z.string().uuid(),
  }),
  handler: generatePlayoffFromGroupsHandler,
});

/**
 * Arranges teams for cross-group seeding in the bracket.
 * Pattern: 1st of Group A vs last qualifier of last Group, etc.
 * This ensures teams from the same group don't meet each other in early rounds.
 */
function arrangeCrossGroupSeeding(
  qualifiedTeams: { equipoId: string; grupo: string; position: number }[],
  groups: string[],
  clasificadosPorGrupo: number,
): string[] {
  const numGroups = groups.length;
  const totalTeams = qualifiedTeams.length;

  // Simple cross-group arrangement:
  // If 2 grupos (A,B) with 2 clasificados each: A1 vs B2, B1 vs A2
  // If 4 grupos (A,B,C,D) with 1 clasificado: A1 vs D1, B1 vs C1
  // If 4 grupos (A,B,C,D) with 2 clasificados: A1 vs B2, C1 vs D2, B1 vs A2, D1 vs C2

  if (clasificadosPorGrupo === 1) {
    // Simple: pair first group with last group
    const result: string[] = [];
    for (let i = 0; i < Math.floor(numGroups / 2); i++) {
      const topGroup = groups[i];
      const bottomGroup = groups[numGroups - 1 - i];
      const top = qualifiedTeams.find(t => t.grupo === topGroup && t.position === 1);
      const bottom = qualifiedTeams.find(t => t.grupo === bottomGroup && t.position === 1);
      if (top) result.push(top.equipoId);
      if (bottom) result.push(bottom.equipoId);
    }
    return result;
  }

  // clasificadosPorGrupo === 2 (most common)
  // A1, B2, C1, D2, ... B1, A2, D1, C2 (crossed)
  const result: string[] = [];
  const halfGroups = Math.floor(numGroups / 2);

  // Top half bracket: 1st of group[i] vs 2nd of group[numGroups - 1 - i]
  for (let i = 0; i < halfGroups; i++) {
    const topGroup = groups[i];
    const crossGroup = groups[numGroups - 1 - i];
    const first = qualifiedTeams.find(t => t.grupo === topGroup && t.position === 1);
    const second = qualifiedTeams.find(t => t.grupo === crossGroup && t.position === 2);
    if (first) result.push(first.equipoId);
    if (second) result.push(second.equipoId);
  }

  // Bottom half bracket: 1st of group[numGroups - 1 - i] vs 2nd of group[i]
  for (let i = 0; i < halfGroups; i++) {
    const topGroup = groups[numGroups - 1 - i];
    const crossGroup = groups[i];
    const first = qualifiedTeams.find(t => t.grupo === topGroup && t.position === 1);
    const second = qualifiedTeams.find(t => t.grupo === crossGroup && t.position === 2);
    if (first) result.push(first.equipoId);
    if (second) result.push(second.equipoId);
  }

  return result;
}

/**
 * Generates single-elimination bracket (reused from single elimination logic).
 */
function generateBracket(equipos: string[]): BracketPartido[] {
  const n = equipos.length;
  const rounds = Math.ceil(Math.log2(n));

  const getRoundName = (roundNum: number, totalRounds: number): Ronda => {
    if (roundNum === totalRounds) return 'F';
    if (roundNum === totalRounds - 1) return 'SF';
    if (roundNum === totalRounds - 2) return 'Q';
    return `R${roundNum}` as Ronda;
  };

  const bracket: BracketPartido[] = [];

  // First round: pair teams [0] vs [1], [2] vs [3], etc.
  const firstRoundMatches: Array<{ local: string; visitante: string }> = [];
  for (let i = 0; i < n; i += 2) {
    firstRoundMatches.push({
      local: equipos[i],
      visitante: equipos[i + 1] || 'TBD',
    });
  }

  let currentRoundMatches = firstRoundMatches;
  let currentRound = 1;

  while (currentRound <= rounds) {
    const roundName = getRoundName(currentRound, rounds);
    const matchesInRound = currentRoundMatches.length;
    const startOfRoundIndex = bracket.length;
    const nextRoundStartIndex = startOfRoundIndex + matchesInRound;

    for (let i = 0; i < matchesInRound; i++) {
      const match = currentRoundMatches[i];
      const siguienteIndex = currentRound < rounds
        ? nextRoundStartIndex + Math.floor(i / 2)
        : undefined;

      bracket.push({
        local: match.local,
        visitante: match.visitante,
        ronda: roundName,
        siguiente_partido_index: siguienteIndex,
      });
    }

    if (currentRound < rounds) {
      const nextRoundMatches: Array<{ local: string; visitante: string }> = [];
      for (let i = 0; i < matchesInRound / 2; i++) {
        nextRoundMatches.push({ local: 'TBD', visitante: 'TBD' });
      }
      currentRoundMatches = nextRoundMatches;
    }

    currentRound++;
  }

  return bracket;
}
