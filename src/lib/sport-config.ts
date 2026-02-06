/**
 * Sport Configuration System
 * Centralized sport-specific configurations for the multi-sport platform
 */

export interface SportConfig {
  id: string;
  nombre: string;
  slug: string;
  scoreLabel: string;
  scoreLabelPlural: string;
  statsLabels: {
    favor: string;
    contra: string;
    diferencia: string;
  };
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  hasDraws: boolean;
  icon: string;
}

/**
 * Sport configuration catalog
 * These configurations match the database deportes table
 */
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  futbol: {
    id: 'futbol',
    nombre: 'Fútbol',
    slug: 'futbol',
    scoreLabel: 'Gol',
    scoreLabelPlural: 'Goles',
    statsLabels: {
      favor: 'GF', // Goles a Favor
      contra: 'GC', // Goles en Contra
      diferencia: 'DG', // Diferencia de Goles
    },
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0,
    hasDraws: true,
    icon: '⚽',
  },
  volleyball: {
    id: 'volleyball',
    nombre: 'Volleyball',
    slug: 'volleyball',
    scoreLabel: 'Set',
    scoreLabelPlural: 'Sets',
    statsLabels: {
      favor: 'SF', // Sets a Favor
      contra: 'SC', // Sets en Contra
      diferencia: 'DS', // Diferencia de Sets
    },
    pointsForWin: 3,
    pointsForDraw: 0,
    pointsForLoss: 0,
    hasDraws: false,
    icon: '🏐',
  },
  basketball: {
    id: 'basketball',
    nombre: 'Basketball',
    slug: 'basketball',
    scoreLabel: 'Punto',
    scoreLabelPlural: 'Puntos',
    statsLabels: {
      favor: 'PF', // Puntos a Favor
      contra: 'PC', // Puntos en Contra
      diferencia: 'DP', // Diferencia de Puntos
    },
    pointsForWin: 2,
    pointsForDraw: 0,
    pointsForLoss: 0,
    hasDraws: false,
    icon: '🏀',
  },
  beisbol: {
    id: 'beisbol',
    nombre: 'Beisbol',
    slug: 'beisbol',
    scoreLabel: 'Carrera',
    scoreLabelPlural: 'Carreras',
    statsLabels: {
      favor: 'CF', // Carreras a Favor
      contra: 'CC', // Carreras en Contra
      diferencia: 'DC', // Diferencia de Carreras
    },
    pointsForWin: 2,
    pointsForDraw: 0,
    pointsForLoss: 0,
    hasDraws: false,
    icon: '⚾',
  },
};

/**
 * Get sport configuration by slug
 */
export function getSportConfig(slug: string): SportConfig | null {
  return SPORT_CONFIGS[slug] || null;
}

/**
 * Get all available sports
 */
export function getAllSports(): SportConfig[] {
  return Object.values(SPORT_CONFIGS);
}

/**
 * Check if a sport allows draws/ties
 */
export function sportAllowsDraws(slug: string): boolean {
  const config = getSportConfig(slug);
  return config?.hasDraws ?? false;
}

/**
 * Get scoring terminology for a sport
 * @param slug - Sport slug (futbol, volleyball, etc.)
 * @param plural - Whether to return plural form
 */
export function getScoreLabel(slug: string, plural: boolean = false): string {
  const config = getSportConfig(slug);
  if (!config) return plural ? 'Puntos' : 'Punto';
  return plural ? config.scoreLabelPlural : config.scoreLabel;
}

/**
 * Get stats column labels for standings table
 */
export function getStatsLabels(slug: string) {
  const config = getSportConfig(slug);
  return config?.statsLabels ?? { favor: 'PF', contra: 'PC', diferencia: 'DP' };
}

/**
 * Calculate points for match result based on sport
 * @param slug - Sport slug
 * @param teamScore - Score of the team
 * @param opponentScore - Score of the opponent
 * @returns Points awarded (3 for win, 1 for draw, 0 for loss)
 */
export function calculateMatchPoints(
  slug: string,
  teamScore: number,
  opponentScore: number
): number {
  const config = getSportConfig(slug);
  if (!config) return 0;

  if (teamScore > opponentScore) {
    return config.pointsForWin;
  } else if (teamScore === opponentScore && config.hasDraws) {
    return config.pointsForDraw;
  } else {
    return config.pointsForLoss;
  }
}
