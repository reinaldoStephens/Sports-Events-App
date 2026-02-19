import type { Database } from '@/lib/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

type Jornada = Database['public']['Tables']['jornadas']['Row'];
type Partido = Database['public']['Tables']['partidos']['Row'];

export interface PhaseValidationResult {
  canGenerate: boolean;
  reason?: string;
  currentMatchCount?: number;
  maxMatches?: number;
}

export interface AggregateScoreResult {
  localAgregado: number;
  visitanteAgregado: number;
  ganadorId: string | null;
  requierePenales: boolean;
  usedAwayGoals?: boolean;
}

/**
 * Validates if new matches can be generated for a phase (jornada)
 * 
 * @param supabase - Supabase client (use admin client for server-side)
 * @param jornadaId - UUID of the jornada to validate
 * @returns Validation result with canGenerate flag and reason if blocked
 * 
 * @example
 * const result = await canGenerateMatches(supabaseAdmin, jornadaId);
 * if (!result.canGenerate) {
 *   console.error(result.reason);
 * }
 */
export async function canGenerateMatches(
  supabase: SupabaseClient<Database>,
  jornadaId: string
): Promise<PhaseValidationResult> {
  // 1. Get jornada details
  const { data: jornada, error } = await supabase
    .from('jornadas')
    .select('*')
    .eq('id', jornadaId)
    .single();

  if (error || !jornada) {
    return { canGenerate: false, reason: 'Jornada no encontrada' };
  }

  // 2. Check phase state
  if (jornada.fase_estado === 'completada') {
    return { canGenerate: false, reason: 'Fase ya completada' };
  }

  if (jornada.fase_estado === 'bloqueada') {
    return { canGenerate: false, reason: 'Fase bloqueada por administrador' };
  }

  // 3. Check match limit
  if (jornada.max_partidos !== null) {
    const { count } = await supabase
      .from('partidos')
      .select('*', { count: 'exact', head: true })
      .eq('jornada_id', jornadaId);

    if (count !== null && count >= jornada.max_partidos) {
      return {
        canGenerate: false,
        reason: `Límite de partidos alcanzado (${count}/${jornada.max_partidos})`,
        currentMatchCount: count,
        maxMatches: jornada.max_partidos,
      };
    }
  }

  // 4. For two-legged phases, check if both legs exist
  if (jornada.es_ida_vuelta) {
    const { data: matches } = await supabase
      .from('partidos')
      .select('es_partido_ida, es_partido_vuelta')
      .eq('jornada_id', jornadaId);

    if (matches && matches.length > 0) {
      const hasIda = matches.some(m => m.es_partido_ida);
      const hasVuelta = matches.some(m => m.es_partido_vuelta);

      if (hasIda && hasVuelta) {
        return {
          canGenerate: false,
          reason: 'Partidos de ida y vuelta ya generados',
        };
      }
    }
  }

  return { canGenerate: true };
}

/**
 * Calculate aggregate score for two-legged tie
 * 
 * @param partidoIda - First leg match
 * @param partidoVuelta - Second leg match (return match)
 * @param usaGolVisitante - Apply away goals rule (deprecated in modern football)
 * @returns Aggregate score result with winner and penalty flag
 * 
 * @example
 * // First leg: Team A 2-1 Team B (at A's home)
 * // Second leg: Team B 1-0 Team A (at B's home)
 * // Aggregate: 2-2, but Team B wins on away goals
 * const result = calculateAggregateScore(ida, vuelta, true);
 * // result.ganadorId = Team B's ID
 * // result.usedAwayGoals = true
 */
export function calculateAggregateScore(
  partidoIda: Partido,
  partidoVuelta: Partido,
  usaGolVisitante: boolean = false
): AggregateScoreResult {
  // Validate that these are actually related matches
  if (partidoIda.partido_relacionado_id !== partidoVuelta.id &&
      partidoVuelta.partido_relacionado_id !== partidoIda.id) {
    console.warn('Matches may not be related - partido_relacionado_id mismatch');
  }

  // Calculate aggregate scores
  // In first leg: Team A (local) vs Team B (visitante)
  // In second leg: Team B (local) vs Team A (visitante)
  // So Team A's total = ida.local + vuelta.visitante
  const localAgregado = (partidoIda.puntos_local || 0) + (partidoVuelta.puntos_visitante || 0);
  const visitanteAgregado = (partidoIda.puntos_visitante || 0) + (partidoVuelta.puntos_local || 0);

  // Check if tied on aggregate
  if (localAgregado === visitanteAgregado) {
    // Away goals rule (if enabled)
    if (usaGolVisitante) {
      // Goals scored away from home
      const golesVisitanteLocal = partidoVuelta.puntos_visitante || 0; // Team A scored at B's home
      const golesVisitanteVisitante = partidoIda.puntos_visitante || 0; // Team B scored at A's home

      if (golesVisitanteLocal > golesVisitanteVisitante) {
        return {
          localAgregado,
          visitanteAgregado,
          ganadorId: partidoIda.equipo_local_id,
          requierePenales: false,
          usedAwayGoals: true,
        };
      } else if (golesVisitanteVisitante > golesVisitanteLocal) {
        return {
          localAgregado,
          visitanteAgregado,
          ganadorId: partidoIda.equipo_visitante_id,
          requierePenales: false,
          usedAwayGoals: true,
        };
      }
    }

    // Still tied - requires penalties
    return {
      localAgregado,
      visitanteAgregado,
      ganadorId: null,
      requierePenales: true,
    };
  }

  // Clear winner by aggregate
  const ganadorId = localAgregado > visitanteAgregado
    ? partidoIda.equipo_local_id
    : partidoIda.equipo_visitante_id;

  return {
    localAgregado,
    visitanteAgregado,
    ganadorId,
    requierePenales: false,
  };
}

/**
 * Update phase state based on match completion
 * This is also handled by database trigger, but can be called manually
 * 
 * @param supabase - Supabase client
 * @param jornadaId - UUID of the jornada to update
 */
export async function updatePhaseState(
  supabase: SupabaseClient<Database>,
  jornadaId: string
): Promise<void> {
  const { data: matches } = await supabase
    .from('partidos')
    .select('estado_partido')
    .eq('jornada_id', jornadaId);

  if (!matches || matches.length === 0) {
    // No matches yet, keep as pendiente
    return;
  }

  const allFinished = matches.every(m => m.estado_partido === 'finalizado');
  const someInProgress = matches.some(m => m.estado_partido === 'en_curso');

  let newState: string;
  if (allFinished) {
    newState = 'completada';
  } else if (someInProgress) {
    newState = 'en_curso';
  } else {
    newState = 'pendiente';
  }

  await supabase
    .from('jornadas')
    .update({ fase_estado: newState })
    .eq('id', jornadaId);
}

/**
 * Check if a phase is locked (read-only)
 * 
 * @param jornada - Jornada object
 * @returns True if phase is locked and should be read-only
 */
export function isPhaseReadOnly(jornada: Jornada): boolean {
  return jornada.fase_estado === 'completada' || jornada.fase_estado === 'bloqueada';
}

/**
 * Get human-readable phase name
 * 
 * @param faseTipo - Phase type code
 * @returns Localized phase name
 */
export function getPhaseName(faseTipo: string | null): string {
  const names: Record<string, string> = {
    'group': 'Fase de Grupos',
    'round_of_16': 'Octavos de Final',
    'quarterfinals': 'Cuartos de Final',
    'semifinals': 'Semifinales',
    'final': 'Final',
    'third_place': 'Tercer Lugar',
  };

  return names[faseTipo || ''] || faseTipo || 'Fase';
}
