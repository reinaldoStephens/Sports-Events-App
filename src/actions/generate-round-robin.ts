import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { JornadaGenerada, PartidoGenerado, GenerateFixtureResult } from '../lib/tournament-types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Standalone handler for server-side use
export const generateRoundRobinHandler = async ({ torneoId, doubleRound }: { torneoId: string; doubleRound: boolean }): Promise<GenerateFixtureResult> => {
    console.log('🟦 [RoundRobin] Handler called with:', { torneoId, doubleRound });
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
      // 1. Verificar que el torneo existe
      console.log('🟦 [RoundRobin] Step 1: Checking tournament exists...');
      const { data: torneo, error: torneoError } = await supabase
        .from('torneos')
        .select('id, nombre')
        .eq('id', torneoId)
        .single();

      if (torneoError || !torneo) {
        console.error('🔴 [RoundRobin] Tournament not found:', torneoError);
        return {
          success: false,
          message: 'Torneo no encontrado',
          error: torneoError?.message
        };
      }

      console.log('🟦 [RoundRobin] Tournament found:', torneo.nombre);

      // 2. Verificar que no existan jornadas previas
      console.log('🟦 [RoundRobin] Step 2: Checking for existing jornadas...');
      const { data: jornadasExistentes } = await supabase
        .from('jornadas')
        .select('id')
        .eq('torneo_id', torneoId)
        .limit(1);

      if (jornadasExistentes && jornadasExistentes.length > 0) {
        console.warn('⚠️ [RoundRobin] Jornadas already exist');
        return {
          success: false,
          message: 'El torneo ya tiene jornadas creadas. Elimina las jornadas existentes antes de generar automáticamente.',
        };
      }

      console.log('🟦 [RoundRobin] No existing jornadas found');

      // 3. Obtener equipos inscritos y aprobados
      console.log('🟦 [RoundRobin] Step 3: Fetching participants...');
      const { data: participantes, error: participantesError } = await supabase
        .from('torneo_participantes')
        .select('equipo_id')
        .eq('torneo_id', torneoId);
        // Note: No status filter - all registered teams are included, matching elimination tournament behavior


      if (participantesError) {
        console.error('🔴 [RoundRobin] Error fetching participants:', participantesError);
        return {
          success: false,
          message: 'Error al obtener equipos inscritos',
          error: participantesError.message
        };
      }

      console.log('🟦 [RoundRobin] Participants found:', participantes?.length || 0);

      if (!participantes || participantes.length < 2) {
        console.warn('⚠️ [RoundRobin] Not enough participants');
        return {
          success: false,
          message: 'Se necesitan al menos 2 equipos inscritos para generar el fixture.',
        };
      }

      if (participantes.length % 2 !== 0) {
        console.warn('⚠️ [RoundRobin] Odd number of participants');
        return {
          success: false,
          message: 'El número de equipos debe ser par. No se admiten BYEs en este momento (todos los equipos deben jugar en cada jornada).',
        };
      }

      const equipoIds = participantes.map(p => p.equipo_id);
      console.log('🟦 [RoundRobin] Team IDs:', equipoIds);

      // Shuffle teams for randomization (Fisher-Yates algorithm)
      const shuffledEquipoIds = [...equipoIds];
      for (let i = shuffledEquipoIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledEquipoIds[i], shuffledEquipoIds[j]] = [shuffledEquipoIds[j], shuffledEquipoIds[i]];
      }

      // 4. Generar fixture usando algoritmo del círculo
      console.log('🟦 [RoundRobin] Step 4: Generating fixture with doubleRound:', doubleRound);
      const jornadas = generateRoundRobinFixture(shuffledEquipoIds, doubleRound);
      console.log('🟦 [RoundRobin] Generated jornadas:', jornadas.length);

      // 5. Insertar jornadas y partidos en la base de datos
      console.log('🟦 [RoundRobin] Step 5: Inserting jornadas and partidos...');
      let jornadasCreadas = 0;
      let partidosCreados = 0;

      for (const jornada of jornadas) {
        // Crear jornada
        const { data: jornadaCreada, error: jornadaError } = await supabase
          .from('jornadas')
          .insert({
            torneo_id: torneoId,
            numero_jornada: jornada.numero,
            nombre_fase: jornada.nombre || `Jornada ${jornada.numero}`,
          })
          .select('id')
          .single();

        if (jornadaError || !jornadaCreada) {
          console.error('🔴 [RoundRobin] Error creating jornada:', jornadaError);
          throw new Error(`Error al crear jornada ${jornada.numero}: ${jornadaError?.message}`);
        }

        jornadasCreadas++;

        // Crear partidos de la jornada
        const partidosToInsert = jornada.partidos.map(partido => ({
          jornada_id: jornadaCreada.id,
          torneo_id: torneoId,
          equipo_local_id: partido.local,
          equipo_visitante_id: partido.visitante,
          estado_partido: 'pendiente' as const,
        }));

        const { error: partidosError } = await supabase
          .from('partidos')
          .insert(partidosToInsert);

        if (partidosError) {
          console.error('🔴 [RoundRobin] Error creating partidos:', partidosError);
          throw new Error(`Error al crear partidos de jornada ${jornada.numero}: ${partidosError.message}`);
        }

        partidosCreados += partidosToInsert.length;
      }

      console.log('🟦 [RoundRobin] Created:', { jornadasCreadas, partidosCreados });

      // 6. Activar el torneo automáticamente
      console.log('🟦 [RoundRobin] Step 6: Activating tournament...');
      const { error: activationError } = await supabase
        .from('torneos')
        .update({ estado: 'activo' })
        .eq('id', torneoId);

      if (activationError) {
        console.warn('⚠️ [RoundRobin] Error activating tournament:', activationError);
      } else {
        console.log('🟢 [RoundRobin] Tournament activated successfully');
      }

      const successMessage = `Fixture generado exitosamente: ${jornadasCreadas} jornadas, ${partidosCreados} partidos. Torneo activado.`;
      console.log('🟢 [RoundRobin] Success:', successMessage);
      return {
        success: true,
        message: successMessage,
        jornadas_creadas: jornadasCreadas,
        partidos_creados: partidosCreados,
      };

    } catch (error) {
      console.error('🔴 [RoundRobin] Exception in handler:', error);
      return {
        success: false,
        message: `Error al generar fixture: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
};

export const generateRoundRobin = defineAction({
  input: z.object({
    torneoId: z.string().uuid(),
    doubleRound: z.boolean().default(false),
  }),
  handler: generateRoundRobinHandler,
});

/**
 * Genera fixture Round-Robin usando el algoritmo del círculo
 * @param equipos Array de IDs de equipos
 * @param doubleRound Si es true, genera ida y vuelta
 */
function generateRoundRobinFixture(equipos: string[], doubleRound: boolean): JornadaGenerada[] {
  const n = equipos.length;
  // Validation ensures n is even, so no BYEs needed
  const teams = [...equipos];
  const totalTeams = teams.length;
  const jornadas: JornadaGenerada[] = [];

  // Generar jornadas (totalTeams - 1 para round-robin simple)
  for (let round = 0; round < totalTeams - 1; round++) {
    const partidos: PartidoGenerado[] = [];
    
    // Emparejar equipos
    for (let i = 0; i < totalTeams / 2; i++) {
      const home = teams[i];
      const away = teams[totalTeams - 1 - i];
      
      // No crear partido si uno es BYE
      if (home !== 'BYE' && away !== 'BYE') {
        partidos.push({ 
          local: home, 
          visitante: away 
        });
      }
    }
    
    jornadas.push({ 
      numero: round + 1, 
      nombre: `Jornada ${round + 1}`,
      partidos 
    });
    
    // Rotar equipos (el primero se queda fijo, los demás rotan)
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  // Si es doble vuelta, duplicar con partidos invertidos
  if (doubleRound) {
    const segundaVuelta = jornadas.map((jornada, idx) => ({
      numero: jornada.numero + (totalTeams - 1),
      nombre: `Jornada ${jornada.numero + (totalTeams - 1)}`,
      partidos: jornada.partidos.map(p => ({
        local: p.visitante,
        visitante: p.local
      }))
    }));
    return [...jornadas, ...segundaVuelta];
  }

  return jornadas;
}
