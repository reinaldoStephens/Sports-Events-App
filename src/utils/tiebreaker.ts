/**
 * Tiebreaker utility for elimination tournament matches
 * Implements UEFA Champions League-style tiebreaking logic
 */

export interface Match {
  id: string;
  goles_local: number | null;
  goles_visitante: number | null;
  goles_local_tiempo_extra: number | null;
  goles_visitante_tiempo_extra: number | null;
  penales_jugados: boolean;
  penales_local: number | null;
  penales_visitante: number | null;
  equipo_local_id: string;
  equipo_visitante_id: string;
}

export interface TiebreakerResult {
  winner: 'local' | 'visitante' | 'empate';
  method: 'aggregate' | 'away_goals' | 'extra_time' | 'penalties';
  details: string;
  aggregate_local: number;
  aggregate_visitante: number;
}

/**
 * Calculate total goals for a team in a match (regular + extra time)
 */
function getTotalGoals(golesRegulares: number | null, golesExtra: number | null): number {
  return (golesRegulares || 0) + (golesExtra || 0);
}

/**
 * Determine winner for a two-legged elimination tie
 * @param match1 First leg match
 * @param match2 Second leg match  
 * @param useAwayGoals Enable away goals rule (default: false, per UEFA 2021+)
 * @returns TiebreakerResult with winner and method used
 */
export function determineTwoLeggedTieWinner(
  match1: Match,
  match2: Match,
  useAwayGoals: boolean = false
): TiebreakerResult {
  // Calculate aggregate scores (regular + extra time for both legs)
  const team1TotalLeg1 = getTotalGoals(match1.goles_local, match1.goles_local_tiempo_extra);
  const team2TotalLeg1 = getTotalGoals(match1.goles_visitante, match1.goles_visitante_tiempo_extra);
  
  const team1TotalLeg2 = getTotalGoals(match2.goles_visitante, match2.goles_visitante_tiempo_extra);
  const team2TotalLeg2 = getTotalGoals(match2.goles_local, match2.goles_local_tiempo_extra);
  
  const aggregateTeam1 = team1TotalLeg1 + team1TotalLeg2;
  const aggregateTeam2 = team2TotalLeg1 + team2TotalLeg2;
  
  // Step 1: Check aggregate score
  if (aggregateTeam1 > aggregateTeam2) {
    return {
      winner: 'local',
      method: 'aggregate',
      details: `Equipo local gana por marcador global ${aggregateTeam1}-${aggregateTeam2}`,
      aggregate_local: aggregateTeam1,
      aggregate_visitante: aggregateTeam2
    };
  }
  
  if (aggregateTeam2 > aggregateTeam1) {
    return {
      winner: 'visitante',
      method: 'aggregate',
      details: `Equipo visitante gana por marcador global ${aggregateTeam2}-${aggregateTeam1}`,
      aggregate_local: aggregateTeam1,
      aggregate_visitante: aggregateTeam2
    };
  }
  
  // Step 2: Aggregate is tied - check away goals rule (if enabled)
  if (useAwayGoals) {
    const team1AwayGoals = team1TotalLeg2;
    const team2AwayGoals = team2TotalLeg1;
    
    if (team1AwayGoals > team2AwayGoals) {
      return {
        winner: 'local',
        method: 'away_goals',
        details: `Equipo local gana por goles de visitante (${team1AwayGoals} vs ${team2AwayGoals})`,
        aggregate_local: aggregateTeam1,
        aggregate_visitante: aggregateTeam2
      };
    }
    
    if (team2AwayGoals > team1AwayGoals) {
      return {
        winner: 'visitante',
        method: 'away_goals',
        details: `Equipo visitante gana por goles de visitante (${team2AwayGoals} vs ${team1AwayGoals})`,
        aggregate_local: aggregateTeam1,
        aggregate_visitante: aggregateTeam2
      };
    }
  }
  
  // Step 3: Check if second leg had extra time
  if (match2.goles_local_tiempo_extra !== null || match2.goles_visitante_tiempo_extra !== null) {
    const extraTimeLocal = match2.goles_local_tiempo_extra || 0;
    const extraTimeVisitante = match2.goles_visitante_tiempo_extra || 0;
    
    // Note: In two-legged ties, if playing extra time in second leg,
    // away goals in extra time may count double (pre-2021 UEFA rule)
    // For now, we just check who scored more in extra time
    if (extraTimeLocal > extraTimeVisitante) {
      return {
        winner: 'local',
        method: 'extra_time',
        details: `Equipo local gana en tiempo extra`,
        aggregate_local: aggregateTeam1,
        aggregate_visitante: aggregateTeam2
      };
    }
    
    if (extraTimeVisitante > extraTimeLocal) {
      return {
        winner: 'visitante',
        method: 'extra_time',
        details: `Equipo visitante gana en tiempo extra`,
        aggregate_local: aggregateTeam1,
        aggregate_visitante: aggregateTeam2
      };
    }
  }
  
  // Step 4: Check penalty shootout (should be in second leg)
  if (match2.penales_jugados && match2.penales_local !== null && match2.penales_visitante !== null) {
    if (match2.penales_local > match2.penales_visitante) {
      return {
        winner: 'local',
        method: 'penalties',
        details: `Equipo local gana en penales (${match2.penales_local}-${match2.penales_visitante})`,
        aggregate_local: aggregateTeam1,
        aggregate_visitante: aggregateTeam2
      };
    }
    
    if (match2.penales_visitante > match2.penales_local) {
      return {
        winner: 'visitante',
        method: 'penalties',
        details: `Equipo visitante gana en penales (${match2.penales_visitante}-${match2.penales_local})`,
        aggregate_local: aggregateTeam1,
        aggregate_visitante: aggregateTeam2
      };
    }
  }
  
  // If we get here, it's still a tie (shouldn't happen in elimination)
  return {
    winner: 'empate',
    method: 'aggregate',
    details: `Empate global ${aggregateTeam1}-${aggregateTeam2} (pendiente de resolución)`,
    aggregate_local: aggregateTeam1,
    aggregate_visitante: aggregateTeam2
  };
}

/**
 * Determine winner for a single elimination match
 * @param match Single match
 * @returns TiebreakerResult with winner and method used
 */
export function determineSingleMatchWinner(match: Match): TiebreakerResult {
  const totalLocal = getTotalGoals(match.goles_local, match.goles_local_tiempo_extra);
  const totalVisitante = getTotalGoals(match.goles_visitante, match.goles_visitante_tiempo_extra);
  
  // Step 1: Check regular + extra time score
  if (totalLocal > totalVisitante) {
    return {
      winner: 'local',
      method: match.goles_local_tiempo_extra ? 'extra_time' : 'aggregate',
      details: `Equipo local gana ${totalLocal}-${totalVisitante}`,
      aggregate_local: totalLocal,
      aggregate_visitante: totalVisitante
    };
  }
  
  if (totalVisitante > totalLocal) {
    return {
      winner: 'visitante',
      method: match.goles_visitante_tiempo_extra ? 'extra_time' : 'aggregate',
      details: `Equipo visitante gana ${totalVisitante}-${totalLocal}`,
      aggregate_local: totalLocal,
      aggregate_visitante: totalVisitante
    };
  }
  
  // Step 2: Check penalty shootout
  if (match.penales_jugados && match.penales_local !== null && match.penales_visitante !== null) {
    if (match.penales_local > match.penales_visitante) {
      return {
        winner: 'local',
        method: 'penalties',
        details: `Equipo local gana en penales (${match.penales_local}-${match.penales_visitante})`,
        aggregate_local: totalLocal,
        aggregate_visitante: totalVisitante
      };
    }
    
    if (match.penales_visitante > match.penales_local) {
      return {
        winner: 'visitante',
        method: 'penalties',
        details: `Equipo visitante gana en penales (${match.penales_visitante}-${match.penales_local})`,
        aggregate_local: totalLocal,
        aggregate_visitante: totalVisitante
      };
    }
  }
  
  // Still tied
  return {
    winner: 'empate',
    method: 'aggregate',
    details: `Empate ${totalLocal}-${totalVisitante} (pendiente de resolución)`,
    aggregate_local: totalLocal,
    aggregate_visitante: totalVisitante
  };
}

/**
 * Format match result for display with separated periods
 */
export function formatMatchResult(match: Match): string {
  const regular = `${match.goles_local || 0}-${match.goles_visitante || 0}`;
  const parts: string[] = [regular];
  
  if (match.goles_local_tiempo_extra !== null || match.goles_visitante_tiempo_extra !== null) {
    const extra = `${match.goles_local_tiempo_extra || 0}-${match.goles_visitante_tiempo_extra || 0} TE`;
    parts.push(extra);
  }
  
  if (match.penales_jugados && match.penales_local !== null && match.penales_visitante !== null) {
    const penalties = `${match.penales_local}-${match.penales_visitante} Pen`;
    parts.push(penalties);
  }
  
  if (parts.length === 1) {
    return parts[0];
  }
  
  return `${parts[0]} (${parts.slice(1).join(', ')})`;
}
