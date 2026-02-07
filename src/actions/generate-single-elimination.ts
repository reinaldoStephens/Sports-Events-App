import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { JornadaGenerada, Ronda, GenerateFixtureResult } from '../lib/tournament-types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Standalone handler for server-side use
export const generateSingleEliminationHandler = async ({ torneoId, useSeeding }: { torneoId: string; useSeeding: boolean }): Promise<GenerateFixtureResult> => {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
      // 1. Verificar que el torneo existe
      const { data: torneo, error: torneoError } = await supabase
        .from('torneos')
        .select('id, nombre')
        .eq('id', torneoId)
        .single();

      if (torneoError || !torneo) {
        return {
          success: false,
          message: `Torneo no encontrado: ${torneoError?.message}`,
          error: torneoError?.message
        };
      }

      // 2. Verificar que no existan jornadas previas
      const { data: jornadasExistentes } = await supabase
        .from('jornadas')
        .select('id')
        .eq('torneo_id', torneoId)
        .limit(1);

      if (jornadasExistentes && jornadasExistentes.length > 0) {
        return {
          success: false,
          message: 'El torneo ya tiene jornadas creadas. Elimina las jornadas existentes antes de generar automáticamente.',
        };
      }

      // 3. Obtener equipos inscritos
      const query = supabase
        .from('torneo_participantes')
        .select('equipo_id, seed')
        .eq('torneo_id', torneoId)
        .select('equipo_id, seed')
        .eq('torneo_id', torneoId);
        // .eq('status', 'aprobado'); // Allow all teams for testing

      if (useSeeding) {
        query.order('seed', { ascending: true, nullsFirst: false });
      }

      const { data: participantes, error: participantesError } = await query;

      if (participantesError) {
        return {
          success: false,
          message: `Error al obtener equipos inscritos: ${participantesError.message}`,
          error: participantesError.message
        };
      }

      if (!participantes || participantes.length < 2) {
        return {
          success: false,
          message: 'Se necesitan al menos 2 equipos inscritos y aprobados para generar el fixture.',
        };
      }

      // Check if Power of 2 (2, 4, 8, 16, 32...)
      // n & (n-1) === 0 for power of 2
      const n = participantes.length;
      if (!((n > 0) && ((n & (n - 1)) === 0))) {
        return {
            success: false,
            message: `El número de equipos (${n}) debe ser potencia de 2 (2, 4, 8, 16...) para evitar BYEs.`,
        };
      }

      const equipoIds = participantes.map(p => p.equipo_id);

      // Shuffle teams for randomization if not using seeding
      let finalEquipoIds = equipoIds;
      if (!useSeeding) {
        finalEquipoIds = [...equipoIds];
        for (let i = finalEquipoIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalEquipoIds[i], finalEquipoIds[j]] = [finalEquipoIds[j], finalEquipoIds[i]];
        }
      }

      // 4. Generar bracket de eliminación
      const bracket = generateSingleEliminationBracket(finalEquipoIds);

      // 5. Agrupar partidos por ronda
      const roundsMap = new Map<string, BracketPartido[]>();
      bracket.forEach(p => {
        const r = p.ronda;
        if (!roundsMap.has(r)) {
            roundsMap.set(r, []);
        }
        roundsMap.get(r)?.push(p);
      });

      // Ordenar rondas para creación (R1, R2, ..., Q, SF, F)
      const roundOrder = ['R1', 'R2', 'R3', 'R4', 'Q', 'SF', 'F'];
      const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => {
        return roundOrder.indexOf(a) - roundOrder.indexOf(b);
      });

      const partidosCreados: { id: string, ronda: string, originalIndex: number }[] = [];
      let jornadasCreadasCount = 0;

      // 6. Crear Jornadas y Partidos por Ronda
      for (const rondaName of sortedRounds) {
        const matchesInRound = roundsMap.get(rondaName) || [];
        if (matchesInRound.length === 0) continue;

        // Determinar nombre descriptivo de la jornada
        let nombreJornada = `Ronda ${rondaName}`;
        if (rondaName === 'Q') nombreJornada = 'Cuartos de Final';
        if (rondaName === 'SF') nombreJornada = 'Semifinales';
        if (rondaName === 'F') nombreJornada = 'Gran Final';

        // Crear Jornada
        const { data: jornada, error: jornadaError } = await supabase
            .from('jornadas')
            .insert({
                torneo_id: torneoId,
                numero_jornada: sortedRounds.indexOf(rondaName) + 1,
                nombre_fase: nombreJornada,
                fecha_inicio: null, 
                fecha_fin: null
            })
            .select('id')
            .single();

            if (jornadaError || !jornada) {
                throw new Error(`Error al crear jornada ${nombreJornada}: ${jornadaError?.message}`);
            }
            jornadasCreadasCount++;

            // Preparar partidos para insertar
            const partidosToInsert = matchesInRound.map(match => ({
                jornada_id: jornada.id,
                torneo_id: torneoId,
                equipo_local_id: match.local === 'TBD' ? null : match.local,
                equipo_visitante_id: match.visitante === 'TBD' ? null : match.visitante,
                ronda: match.ronda,
                estado_partido: 'pendiente',
            }));

            const { data: insertedMatches, error: matchesError } = await supabase
                .from('partidos')
                .insert(partidosToInsert)
                .select('id, ronda');

            if (matchesError || !insertedMatches) {
                throw new Error(`Error al crear partidos para ${nombreJornada}: ${matchesError?.message}`);
            }

            // Asociar ID generado con el índice original en el array 'bracket' global
            insertedMatches.forEach((m, idx) => {
                 const originalMatchObj = matchesInRound[idx];
                 const originalIndex = bracket.indexOf(originalMatchObj);
                 
                 partidosCreados.push({
                     id: m.id,
                     ronda: m.ronda,
                     originalIndex: originalIndex
                 });
            });
        }


      // 7. Actualizar vínculos siguiente_partido_id
      const partidoIdMap = new Map<number, string>();
      partidosCreados.forEach(p => {
          partidoIdMap.set(p.originalIndex, p.id);
      });

      // Actualizar vínculos
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

      // 8. Activar el torneo automáticamente
      const { error: activationError } = await supabase
        .from('torneos')
        .update({ estado: 'activo' })
        .eq('id', torneoId);

      if (activationError) {
        console.warn('Error al activar torneo:', activationError);
        // Don't fail the whole process, just warn
      }

      return {
        success: true,
        message: `Bracket generado exitosamente: ${partidosCreados.length} partidos en ${jornadasCreadasCount} rondas. Torneo activado.`,
        jornadas_creadas: jornadasCreadasCount,
        partidos_creados: partidosCreados.length,
      };

    } catch (error) {
      console.error('Error en generateSingleElimination:', error);
      return {
        success: false,
        message: `Error al generar bracket: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
};

export const generateSingleElimination = defineAction({
  input: z.object({
    torneoId: z.string().uuid(),
    useSeeding: z.boolean().default(false),
  }),
  handler: generateSingleEliminationHandler,
});

interface BracketPartido {
  local: string;
  visitante: string;
  ronda: Ronda;
  siguiente_partido_index?: number;
}

/**
 * Genera bracket de eliminación simple
 * @param equipos Array de IDs de equipos (debe estar ordenado por seed si aplica)
 */
function generateSingleEliminationBracket(equipos: string[]): BracketPartido[] {
  const n = equipos.length;
  
  // Calcular número de rondas necesarias
  const rounds = Math.ceil(Math.log2(n));
  const totalSlots = Math.pow(2, rounds);
  const byes = totalSlots - n;

  // Nombres de rondas según número de equipos
  const getRoundName = (roundNum: number, totalRounds: number): Ronda => {
    if (roundNum === totalRounds) return 'F'; // Final
    if (roundNum === totalRounds - 1) return 'SF'; // Semifinal
    if (roundNum === totalRounds - 2) return 'Q'; // Cuartos
    return `R${roundNum}` as Ronda; // R1, R2, R3...
  };

  const bracket: BracketPartido[] = [];
  
  // Generar primera ronda con byes
  const primeraRondaPartidos: Array<{ local: string; visitante: string } | null> = [];
  
  for (let i = 0; i < totalSlots / 2; i++) {
    const localIdx = i;
    const visitanteIdx = totalSlots - 1 - i;
    
    const local = equipos[localIdx];
    const visitante = equipos[visitanteIdx];
    
    if (local && visitante) {
      primeraRondaPartidos.push({ local, visitante });
    } 
    // No else required for matched pairs

  }

  // Construir bracket completo
  let currentRoundMatches = primeraRondaPartidos.filter(p => p !== null) as Array<{ local: string; visitante: string }>;
  let currentRound = 1;
  let partidoIndex = 0;

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

      partidoIndex++;
    }

    // Preparar siguiente ronda (placeholders por ahora)
    if (currentRound < rounds) {
      const nextRoundMatches: Array<{ local: string; visitante: string }> = [];
      for (let i = 0; i < matchesInRound / 2; i++) {
        nextRoundMatches.push({
          local: 'TBD', // To Be Determined
          visitante: 'TBD',
        });
      }
      currentRoundMatches = nextRoundMatches;
    }

    currentRound++;
  }

  return bracket;
}
