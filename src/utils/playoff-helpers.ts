import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Helper to create two-legged tie (ida y vuelta) for playoff matches
 * 
 * @param supabase - Supabase client
 * @param torneoId - Tournament ID
 * @param jornadaId - Jornada ID for this phase
 * @param equipoLocal - Home team ID (for first leg)
 * @param equipoVisitante - Away team ID (for first leg)
 * @param ronda - Round name (e.g., 'round_of_16', 'quarterfinals')
 * @param siguientePartidoId - Optional next match ID for winner advancement
 * @returns Object with both match IDs
 */
export async function createTwoLeggedTie(
  supabase: SupabaseClient<any>,
  params: {
    torneoId: string;
    jornadaIdaId: string;
    jornadaVueltaId: string;
    equipoLocal: string;
    equipoVisitante: string;
    ronda: string;
    siguientePartidoId?: string | null;
  }
): Promise<{ partidoIdaId: string; partidoVueltaId: string } | null> {
  const { torneoId, jornadaIdaId, jornadaVueltaId, equipoLocal, equipoVisitante, ronda, siguientePartidoId } = params;

  try {
    // 1. Create FIRST LEG (IDA)
    const { data: partidoIda, error: idaError } = await supabase
      .from('partidos')
      .insert({
        torneo_id: torneoId,
        jornada_id: jornadaIdaId,
        equipo_local_id: equipoLocal,
        equipo_visitante_id: equipoVisitante,
        estado_partido: 'pendiente',
        ronda: ronda,
        es_partido_ida: true,
        siguiente_partido_id: siguientePartidoId,
      })
      .select('id')
      .single();

    if (idaError || !partidoIda) {
      console.error('Error creating first leg:', idaError);
      return null;
    }

    // 2. Create SECOND LEG (VUELTA) - Teams are REVERSED
    const { data: partidoVuelta, error: vueltaError } = await supabase
      .from('partidos')
      .insert({
        torneo_id: torneoId,
        jornada_id: jornadaVueltaId,
        equipo_local_id: equipoVisitante, // REVERSED
        equipo_visitante_id: equipoLocal, // REVERSED
        estado_partido: 'pendiente',
        ronda: ronda,
        es_partido_vuelta: true,
        partido_relacionado_id: partidoIda.id, // Link to first leg
        siguiente_partido_id: siguientePartidoId, // Both point to same next match
      })
      .select('id')
      .single();

    if (vueltaError || !partidoVuelta) {
      console.error('Error creating second leg:', vueltaError);
      // Rollback: delete first leg
      await supabase.from('partidos').delete().eq('id', partidoIda.id);
      return null;
    }

    // 3. Update FIRST LEG with link to SECOND LEG
    await supabase
      .from('partidos')
      .update({ partido_relacionado_id: partidoVuelta.id })
      .eq('id', partidoIda.id);

    console.log(`✅ Created two-legged tie: Ida ${partidoIda.id}, Vuelta ${partidoVuelta.id}`);

    return {
      partidoIdaId: partidoIda.id,
      partidoVueltaId: partidoVuelta.id,
    };
  } catch (error) {
    console.error('Error in createTwoLeggedTie:', error);
    return null;
  }
}

/**
 * Create a single match (for phases that don't use two-legged format)
 */
export async function createSingleMatch(
  supabase: SupabaseClient<any>,
  params: {
    torneoId: string;
    jornadaId: string;
    equipoLocal: string;
    equipoVisitante: string;
    ronda: string;
    siguientePartidoId?: string | null;
  }
): Promise<string | null> {
  const { torneoId, jornadaId, equipoLocal, equipoVisitante, ronda, siguientePartidoId } = params;

  const { data: partido, error } = await supabase
    .from('partidos')
    .insert({
      torneo_id: torneoId,
      jornada_id: jornadaId,
      equipo_local_id: equipoLocal,
      equipo_visitante_id: equipoVisitante,
      estado_partido: 'pendiente',
      ronda: ronda,
      siguiente_partido_id: siguientePartidoId,
    })
    .select('id')
    .single();

  if (error || !partido) {
    console.error('Error creating single match:', error);
    return null;
  }

  return partido.id;
}

/**
 * Determine if a phase should use two-legged format
 * Based on tournament config and phase type
 */
export function shouldUseTwoLegs(
  torneoConfig: any,
  faseTipo: string
): boolean {
  const playoffConfig = torneoConfig?.playoff_config;
  
  if (!playoffConfig) return false;

  // Check if globally enabled
  if (!playoffConfig.usa_ida_vuelta) return false;

  // Check if this specific phase uses two legs
  const fasesIdaVuelta = playoffConfig.fases_ida_vuelta || [];
  
  // Special case: final
  if (faseTipo === 'final') {
    return playoffConfig.final_ida_vuelta === true;
  }

  // Check if phase is in the list
  return fasesIdaVuelta.includes(faseTipo);
}
