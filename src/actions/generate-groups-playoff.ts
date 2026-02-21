import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { JornadaGenerada, PartidoGenerado, GenerateFixtureResult } from '../lib/tournament-types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Generates the group phase for a "Grupos + Playoff" tournament.
 * 1. Validates teams and configuration
 * 2. Assigns teams to groups (random shuffle)
 * 3. Generates round-robin fixtures per group
 * 4. Inserts everything into the database
 * 5. Saves config in torneos.config
 * 6. Activates the tournament
 * 
 * Does NOT generate the playoff phase — that happens after group phase completes.
 */
export const generateGroupsPlayoffHandler = async ({
  torneoId,
  numGrupos,
  clasificadosPorGrupo,
  doubleRound,
  customAssignments,
}: {
  torneoId: string;
  numGrupos: number;
  clasificadosPorGrupo: number;
  doubleRound: boolean;
  customAssignments?: Record<string, string[]>;
}): Promise<GenerateFixtureResult> => {
  console.log('🟦 [GroupsPlayoff] Handler called with:', { torneoId, numGrupos, clasificadosPorGrupo, doubleRound, hasCustomAssignments: !!customAssignments });
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Verify tournament exists
    const { data: torneo, error: torneoError } = await supabase
      .from('torneos')
      .select('id, nombre, tipo')
      .eq('id', torneoId)
      .single();

    if (torneoError || !torneo) {
      return { success: false, message: 'Torneo no encontrado', error: torneoError?.message };
    }

    if (torneo.tipo !== 'grupos_eliminacion') {
      return { success: false, message: 'Este torneo no es de tipo Grupos + Playoff' };
    }

    // 2. Check no existing jornadas (with explicit error handling)
    console.log('🟦 [GroupsPlayoff] Step 2: Checking for existing jornadas...');
    const { data: jornadasExistentes, error: jornadasCheckError } = await supabase
      .from('jornadas')
      .select('id, numero_jornada')
      .eq('torneo_id', torneoId)
      .limit(10); // Get a few to see what exists

    if (jornadasCheckError) {
      console.error('🔴 [GroupsPlayoff] Error checking existing jornadas:', jornadasCheckError);
      return {
        success: false,
        message: 'Error al verificar jornadas existentes',
        error: jornadasCheckError.message,
      };
    }

    if (jornadasExistentes && jornadasExistentes.length > 0) {
      console.warn('⚠️ [GroupsPlayoff] Found existing jornadas:', jornadasExistentes);
      return {
        success: false,
        message: `El torneo ya tiene ${jornadasExistentes.length} jornada(s) creada(s). Elimina las jornadas existentes antes de generar automáticamente.`,
      };
    }

    console.log('🟢 [GroupsPlayoff] No existing jornadas found, proceeding with generation');

    // 3. Get registered teams
    const { data: participantes, error: participantesError } = await supabase
      .from('torneo_participantes')
      .select('equipo_id')
      .eq('torneo_id', torneoId);

    if (participantesError) {
      return { success: false, message: 'Error al obtener equipos inscritos', error: participantesError.message };
    }

    if (!participantes || participantes.length < 2) {
      return { success: false, message: 'Se necesitan al menos 2 equipos inscritos para generar el fixture.' };
    }

    const totalEquipos = participantes.length;

    // 4. Validate configuration
    if (numGrupos < 2) {
      return { success: false, message: 'Se necesitan al menos 2 grupos.' };
    }

    if (totalEquipos < numGrupos * 2) {
      return { success: false, message: `Se necesitan al menos ${numGrupos * 2} equipos para ${numGrupos} grupos (mínimo 2 por grupo).` };
    }

    const totalClasificados = numGrupos * clasificadosPorGrupo;
    // Validate power of 2 for playoff bracket
    if (totalClasificados < 2 || (totalClasificados & (totalClasificados - 1)) !== 0) {
      return {
        success: false,
        message: `El total de clasificados (${totalClasificados} = ${numGrupos} grupos × ${clasificadosPorGrupo} por grupo) debe ser potencia de 2 (2, 4, 8, 16...).`,
      };
    }

    // 5. Assign teams to groups
    const groupNames = Array.from({ length: numGrupos }, (_, i) => String.fromCharCode(65 + i)); // A, B, C, D...
    const groups: Map<string, string[]> = new Map();
    groupNames.forEach(g => groups.set(g, []));

    if (customAssignments) {
        // Validation for custom assignments
        const assignedTeamIds = new Set<string>();
        for (const [groupName, teamIds] of Object.entries(customAssignments)) {
            if (!groupNames.includes(groupName)) {
                return { success: false, message: `El grupo '${groupName}' no es válido para ${numGrupos} grupos.` };
            }
            if (teamIds.length < 2) {
                 return { success: false, message: `El grupo ${groupName} debe tener al menos 2 equipos.` };
            }
            for (const id of teamIds) {
                if (assignedTeamIds.has(id)) {
                    return { success: false, message: `El equipo con ID ${id} está asignado a múltiples grupos.` };
                }
                assignedTeamIds.add(id);
            }
            groups.set(groupName, teamIds);
        }

        if (assignedTeamIds.size !== totalEquipos) {
            return { 
                success: false, 
                message: `La asignación manual está incompleta. Asignados: ${assignedTeamIds.size}, Total: ${totalEquipos}.` 
            };
        }
        
    } else {
        // Shuffle and distribute teams into groups (Automatic)
        const equipoIds = participantes.map(p => p.equipo_id);
        const shuffled = [...equipoIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
    
        // Distribute: round-robin across groups (e.g., A, B, A, B, A, B...)
        shuffled.forEach((equipoId, index) => {
          const groupIndex = index % numGrupos;
          groups.get(groupNames[groupIndex])!.push(equipoId);
        });
    }

    console.log('🟦 [GroupsPlayoff] Groups assigned:', Object.fromEntries(groups));

    // 6. Update torneo_participantes with group assignments
    for (const [groupName, teamIds] of groups) {
      for (const teamId of teamIds) {
        const { error: updateError } = await supabase
          .from('torneo_participantes')
          .update({ grupo: groupName } as any)
          .eq('torneo_id', torneoId)
          .eq('equipo_id', teamId);

        if (updateError) {
          console.error(`Error assigning ${teamId} to group ${groupName}:`, updateError);
          throw new Error(`Error al asignar equipo al grupo ${groupName}: ${updateError.message}`);
        }
      }
    }

    // 7. Generate round-robin fixtures per group
    console.log('🟦 [GroupsPlayoff] Step 7: Generating fixtures for each group...');
    console.log('🟦 [GroupsPlayoff] Total groups:', groups.size);
    
    // First, generate all fixtures for all groups
    const groupFixtures: Map<string, JornadaGenerada[]> = new Map();
    let maxJornadas = 0;
    
    for (const [groupName, teamIds] of groups) {
      console.log(`🟦 [GroupsPlayoff] Processing group ${groupName} with ${teamIds.length} teams`);
      
      if (teamIds.length < 2) {
        console.warn(`⚠️ Group ${groupName} has less than 2 teams, skipping fixtures`);
        continue;
      }

      // Check if odd number — add BYE placeholder
      let teamsForFixture = [...teamIds];
      if (teamsForFixture.length % 2 !== 0) {
        teamsForFixture.push('BYE');
        console.log(`🟦 [GroupsPlayoff] Added BYE to group ${groupName} (odd number of teams)`);
      }

      const jornadas = generateRoundRobinFixture(teamsForFixture, doubleRound);
      console.log(`🟦 [GroupsPlayoff] Generated ${jornadas.length} jornadas for group ${groupName}`);
      
      groupFixtures.set(groupName, jornadas);
      maxJornadas = Math.max(maxJornadas, jornadas.length);
    }

    // Now create jornadas in parallel across groups
    // Jornada 1 for all groups, then Jornada 2 for all groups, etc.

    
    // Now create jornadas in parallel across groups
    // Create ONE single jornada for all groups (e.g. "Fase de Grupos - Jornada 1")
    let jornadasCreadasTotal = 0;
    let partidosCreadosTotal = 0;
    
    for (let jornadaIndex = 0; jornadaIndex < maxJornadas; jornadaIndex++) {
      const jornadaNumero = jornadaIndex + 1;
      const nombreFase = `Fase de Grupos - Jornada ${jornadaNumero}`;

      console.log(`🟦 [GroupsPlayoff] Creating shared jornada: "${nombreFase}" with numero_jornada=${jornadaNumero}`);

      // Create the shared jornada
      const { data: jornadaCreada, error: jornadaError } = await supabase
        .from('jornadas')
        .insert({
          torneo_id: torneoId,
          numero_jornada: jornadaNumero,
          nombre_fase: nombreFase,
        })
        .select('id')
        .single();

      if (jornadaError || !jornadaCreada) {
        console.error('🔴 [GroupsPlayoff] Error creating shared jornada:', {
          nombreFase,
          numero_jornada: jornadaNumero,
          error: jornadaError,
        });
        throw new Error(`Error al crear jornada ${nombreFase}: ${jornadaError?.message}`);
      }

      console.log(`🟢 [GroupsPlayoff] Successfully created shared jornada ID: ${jornadaCreada.id}`);
      jornadasCreadasTotal++;

      // Now add matches from all groups for this round
      for (const [groupName, jornadas] of groupFixtures) {
        if (jornadaIndex >= jornadas.length) continue;
        
        const jornadaData = jornadas[jornadaIndex];
        
        console.log(`🟦 [GroupsPlayoff] Adding matches from Group ${groupName} to Jornada ${jornadaNumero}`);

        const partidosToInsert = jornadaData.partidos.map(partido => ({
          jornada_id: jornadaCreada.id,
          torneo_id: torneoId,
          equipo_local_id: partido.local,
          equipo_visitante_id: partido.visitante,
          estado_partido: 'pendiente' as const,
        }));

        if (partidosToInsert.length > 0) {
          const { error: partidosError } = await supabase
            .from('partidos')
            .insert(partidosToInsert);

          if (partidosError) {
            console.error(`🔴 [GroupsPlayoff] Error creating matches for Group ${groupName} in Jornada ${jornadaNumero}:`, partidosError);
            throw new Error(`Error al crear partidos del Grupo ${groupName}: ${partidosError.message}`);
          }
          partidosCreadosTotal += partidosToInsert.length;
        }
      }
    }


    // 8. Save config to tournament
    const { error: configError } = await supabase
      .from('torneos')
      .update({
        config: {
          num_grupos: numGrupos,
          clasificados_por_grupo: clasificadosPorGrupo,
          double_round: doubleRound,
        },
      } as any)
      .eq('id', torneoId);

    if (configError) {
      console.warn('⚠️ Error saving config:', configError);
    }

    // 9. Activate tournament
    const { error: activationError } = await supabase
      .from('torneos')
      .update({ estado: 'activo' })
      .eq('id', torneoId);

    if (activationError) {
      console.warn('⚠️ Error activating tournament:', activationError);
    }

    const successMessage = `Fase de grupos generada: ${numGrupos} grupos, ${jornadasCreadasTotal} jornadas, ${partidosCreadosTotal} partidos. Torneo activado.`;
    console.log('🟢 [GroupsPlayoff] Success:', successMessage);

    return {
      success: true,
      message: successMessage,
      jornadas_creadas: jornadasCreadasTotal,
      partidos_creados: partidosCreadosTotal,
    };

  } catch (error) {
    console.error('🔴 [GroupsPlayoff] Exception:', error);
    
    // Cleanup: Delete any jornadas that were created before the error
    console.log('🧹 [GroupsPlayoff] Cleaning up partially created jornadas...');
    const { error: cleanupError } = await supabase
      .from('jornadas')
      .delete()
      .eq('torneo_id', torneoId);
    
    if (cleanupError) {
      console.error('⚠️ [GroupsPlayoff] Error during cleanup:', cleanupError);
      return {
        success: false,
        message: `Error al generar fase de grupos: ${error instanceof Error ? error.message : String(error)}. ADVERTENCIA: No se pudieron eliminar las jornadas parciales. Por favor, elimínalas manualmente antes de reintentar.`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    
    console.log('🟢 [GroupsPlayoff] Cleanup successful - all partial jornadas deleted');
    
    return {
      success: false,
      message: `Error al generar fase de grupos: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const generateGroupsPlayoff = defineAction({
  input: z.object({
    torneoId: z.string().uuid(),
    numGrupos: z.number().int().min(2).max(8),
    clasificadosPorGrupo: z.number().int().min(1).max(4),
    doubleRound: z.boolean().default(false),
    customAssignments: z.record(z.array(z.string())).optional(),
  }),
  handler: generateGroupsPlayoffHandler,
});

/**
 * Generates round-robin fixture using the circle algorithm.
 * Reused from generate-round-robin.ts logic.
 */
function generateRoundRobinFixture(equipos: string[], doubleRound: boolean): JornadaGenerada[] {
  const teams = [...equipos];
  const totalTeams = teams.length;
  const jornadas: JornadaGenerada[] = [];

  for (let round = 0; round < totalTeams - 1; round++) {
    const partidos: PartidoGenerado[] = [];

    for (let i = 0; i < totalTeams / 2; i++) {
      const home = teams[i];
      const away = teams[totalTeams - 1 - i];

      // Skip BYE matches
      if (home !== 'BYE' && away !== 'BYE') {
        partidos.push({ local: home, visitante: away });
      }
    }

    jornadas.push({
      numero: round + 1,
      nombre: `Jornada ${round + 1}`,
      partidos,
    });

    // Rotate teams (first stays fixed, rest rotate)
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  if (doubleRound) {
    const segundaVuelta = jornadas.map((jornada, idx) => ({
      numero: jornada.numero + (totalTeams - 1),
      nombre: `Jornada ${jornada.numero + (totalTeams - 1)}`,
      partidos: jornada.partidos.map(p => ({
        local: p.visitante,
        visitante: p.local,
      })),
    }));
    return [...jornadas, ...segundaVuelta];
  }

  return jornadas;
}
