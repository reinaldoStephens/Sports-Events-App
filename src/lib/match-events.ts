import type { SupabaseClient } from '@supabase/supabase-js';

export interface MatchEvent {
  id: string;
  partido_id: string;
  tipo_evento: 'gol' | 'tarjeta_amarilla' | 'tarjeta_roja' | 'sustitucion';
  minuto: number;
  jugador_cedula: string;
  equipo_id: string;
  detalles?: Record<string, any>;
  creado_at: string;
}

/**
 * Calculate match score from events (goals only)
 */
export function calculateScoreFromEvents(
  eventos: MatchEvent[], 
  equipoLocalId: string, 
  equipoVisitanteId: string
): { local: number; visitante: number } {
  const goles = eventos.filter(e => e.tipo_evento === 'gol');
  return {
    local: goles.filter(e => e.equipo_id === equipoLocalId).length,
    visitante: goles.filter(e => e.equipo_id === equipoVisitanteId).length
  };
}

/**
 * Check if a match already exists in a jornada (prevents A vs B and B vs A duplicates)
 */
export async function checkDuplicateMatch(
  supabase: SupabaseClient,
  jornadaId: string,
  equipoA: string,
  equipoB: string,
  excludeMatchId?: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('partidos')
    .select('id')
    .eq('jornada_id', jornadaId)
    .or(`and(equipo_local_id.eq.${equipoA},equipo_visitante_id.eq.${equipoB}),and(equipo_local_id.eq.${equipoB},equipo_visitante_id.eq.${equipoA})`);
  
  if (error) {
    console.error('Error checking duplicate match:', error);
    return false;
  }

  if (excludeMatchId) {
    return data?.some(m => m.id !== excludeMatchId) || false;
  }
  
  return (data?.length || 0) > 0;
}

/**
 * Validate that a player belongs to a team
 */
export async function validatePlayerInTeam(
  supabase: SupabaseClient,
  jugadorCedula: string,
  equipoId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('deportistas')
    .select('equipo_id')
    .eq('numero_cedula', jugadorCedula)
    .single();
  
  if (error || !data) return false;
  return data.equipo_id === equipoId;
}

/**
 * Validate that a team participates in a match
 */
export async function validateTeamInMatch(
  supabase: SupabaseClient,
  partidoId: string,
  equipoId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('partidos')
    .select('equipo_local_id, equipo_visitante_id')
    .eq('id', partidoId)
    .single();
  
  if (error || !data) return false;
  return data.equipo_local_id === equipoId || data.equipo_visitante_id === equipoId;
}
