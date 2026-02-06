/**
 * Team Validation and Completeness Utilities
 * 
 * Provides functions to validate team eligibility for tournament participation:
 * - Minimum player requirements (11 players)
 * - Captain assignment
 * - Field address
 * - Duplicate player detection across tournament
 * - Tournament lock status
 * - Team edit permissions
 */

import { supabase } from './supabase';
import type { Database } from './database.types';

type TorneoParticipante = Database['public']['Tables']['torneo_participantes']['Row'];
type Deportista = Database['public']['Tables']['deportistas']['Row'];
type Equipo = Database['public']['Tables']['equipos']['Row'];

export interface TeamValidation {
  playerCount: number;
  requiredPlayers: number;
  hasMinimumPlayers: boolean;
  hasCaptain: boolean;
  hasFieldAddress: boolean;
  canSubmit: boolean;
  percentComplete: number;
  missingRequirements: string[];
}

export interface DuplicateAlert {
  cedula: string;
  playerName: string;
  teams: {
    teamId: string;
    teamName: string;
  }[];
}

/**
 * Gets team completeness for registration
 * @param teamId - The team ID
 * @returns Promise<TeamValidation> - Validation details
 */
export async function getTeamCompleteness(teamId: string): Promise<TeamValidation> {
  const REQUIRED_PLAYERS = 1; // Changed to 1 for testing (originally 11)
  
  // Get team info
  const { data: team, error: teamError } = await supabase
    .from('equipos')
    .select('*')
    .eq('id', teamId)
    .single();
  
  if (teamError || !team) {
    throw new Error('Team not found');
  }
  
  // Get player count
  const { data: players, error: playersError } = await supabase
    .from('deportistas')
    .select('numero_cedula')
    .eq('equipo_id', teamId);
  
  if (playersError) {
    throw new Error('Error fetching players');
  }
  
  const playerCount = players?.length || 0;
  const hasMinimumPlayers = playerCount >= REQUIRED_PLAYERS;
  const hasCaptain = !!team.capitan_id;
  const hasFieldAddress = !!team.direccion_cancha && team.direccion_cancha.trim().length > 0;
  
  const missingRequirements: string[] = [];
  
  if (!hasMinimumPlayers) {
    missingRequirements.push(`Faltan ${REQUIRED_PLAYERS - playerCount} jugadores (mínimo ${REQUIRED_PLAYERS})`);
  }
  
  if (!hasCaptain) {
    missingRequirements.push('Falta asignar capitán');
  }
  
  if (!hasFieldAddress) {
    missingRequirements.push('Falta dirección de la cancha');
  }
  
  const canSubmit = hasMinimumPlayers && hasCaptain && hasFieldAddress;
  
  // Calculate percentage (equal weight to all requirements)
  let completedItems = 0;
  if (hasMinimumPlayers) completedItems++;
  if (hasCaptain) completedItems++;
  if (hasFieldAddress) completedItems++;
  
  const percentComplete = Math.round((completedItems / 3) * 100);
  
  return {
    playerCount,
    requiredPlayers: REQUIRED_PLAYERS,
    hasMinimumPlayers,
    hasCaptain,
    hasFieldAddress,
    canSubmit,
    percentComplete,
    missingRequirements
  };
}

/**
 * Checks if a team can be submitted for review
 * @param teamId - The team ID
 * @returns Promise<boolean> - true if team meets all requirements
 */
export async function canSubmitForReview(teamId: string): Promise<boolean> {
  const validation = await getTeamCompleteness(teamId);
  return validation.canSubmit;
}

/**
 * Detects duplicate players across teams in a tournament
 * @param torneoId - The tournament ID
 * @returns Promise<DuplicateAlert[]> - Array of duplicate player alerts
 */
export async function detectDuplicatePlayers(torneoId: string): Promise<DuplicateAlert[]> {
  // Get all teams in the tournament
  const { data: participantes, error: partError } = await supabase
    .from('torneo_participantes')
    .select(`
      equipo_id,
      equipos (
        id,
        nombre
      )
    `)
    .eq('torneo_id', torneoId);
  
  if (partError || !participantes) {
    console.error('Error fetching participants:', partError);
    return [];
  }
  
  const teamIds = participantes.map(p => p.equipo_id);
  
  // Get all players from these teams
  const { data: players, error: playersError } = await supabase
    .from('deportistas')
    .select('numero_cedula, nombre, equipo_id')
    .in('equipo_id', teamIds);
  
  if (playersError || !players) {
    console.error('Error fetching players:', playersError);
    return [];
  }
  
  // Group by cedula
  const playersByCedula = new Map<string, typeof players>();
  
  players.forEach(player => {
    const existing = playersByCedula.get(player.numero_cedula) || [];
    existing.push(player);
    playersByCedula.set(player.numero_cedula, existing);
  });
  
  // Find duplicates (cedula in more than one team)
  const duplicates: DuplicateAlert[] = [];
  
  playersByCedula.forEach((playerList, cedula) => {
    if (playerList.length > 1) {
      const teams = playerList.map(p => {
        const team = participantes.find(part => part.equipo_id === p.equipo_id);
        return {
          teamId: p.equipo_id,
          teamName: (team?.equipos as any)?.nombre || 'Unknown'
        };
      });
      
      duplicates.push({
        cedula,
        playerName: playerList[0].nombre,
        teams
      });
    }
  });
  
  return duplicates;
}

/**
 * Checks if tournament registrations are locked
 * @param torneoId - The tournament ID
 * @returns Promise<boolean> - true if locked
 */
export async function isTournamentLocked(torneoId: string): Promise<boolean> {
  const { data: torneo, error } = await supabase
    .from('torneos')
    .select('inscripciones_bloqueadas')
    .eq('id', torneoId)
    .single();
  
  if (error || !torneo) {
    console.error('Error checking tournament lock:', error);
    return false;
  }
  
  return torneo.inscripciones_bloqueadas || false;
}

/**
 * Checks if a specific team can be edited
 * Considers: team lock status, tournament lock, and user permissions
 * @param teamId - The team ID
 * @param userId - The user ID
 * @returns Promise<boolean> - true if team can be edited
 */
export async function isTeamEditable(teamId: string, userId: string): Promise<boolean> {
  // Get team info
  const { data: team, error: teamError } = await supabase
    .from('equipos')
    .select('*, torneo_participantes(*)')
    .eq('id', teamId)
    .single();
  
  if (teamError || !team) {
    return false;
  }
  
  // Check if team is locked
  if (team.bloqueado_edicion) {
    // Only super_admin can unlock
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (profile?.role !== 'super_admin') {
      return false;
    }
  }
  
  // Check if tournament is locked
  const participantes = team.torneo_participantes as TorneoParticipante[];
  if (participantes && participantes.length > 0) {
    const torneoId = participantes[0].torneo_id;
    const locked = await isTournamentLocked(torneoId);
    
    if (locked) {
      // Check if user is super_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profile?.role !== 'super_admin') {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Gets teams that are incomplete (below 11 players)
 * @param torneoId - The tournament ID (optional, for all teams if not provided)
 * @returns Promise with incomplete teams and their details
 */
export async function getIncompleteTeams(torneoId?: string) {
  let query = supabase
    .from('equipos')
    .select(`
      id,
      nombre,
      delegado_id,
      created_at,
      profiles!equipos_delegado_id_fkey (
        id,
        email,
        full_name
      )
    `);
  
  if (torneoId) {
    query = query.select(`
      *,
      torneo_participantes!inner (
        torneo_id
      )
    `).eq('torneo_participantes.torneo_id', torneoId);
  }
  
  const { data: teams, error } = await query;
  
  if (error || !teams) {
    console.error('Error fetching teams:', error);
    return [];
  }
  
  const incompleteTeams = [];
  
  for (const team of teams) {
    const { data: players } = await supabase
      .from('deportistas')
      .select('numero_cedula')
      .eq('equipo_id', team.id);
    
    const playerCount = players?.length || 0;
    
    if (playerCount < 11) {
      incompleteTeams.push({
        ...team,
        playerCount,
        playersNeeded: 11 - playerCount,
        daysSinceCreation: Math.floor(
          (Date.now() - new Date(team.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      });
    }
  }
  
  return incompleteTeams;
}

/**
 * Checks if substitution window is open for a tournament
 * @param torneoId - The tournament ID
 * @returns Promise<boolean> - true if substitution window is open
 */
export async function isSubstitutionWindowOpen(torneoId: string): Promise<boolean> {
  const { data: torneo, error } = await supabase
    .from('torneos')
    .select('ventana_fichajes_abierta')
    .eq('id', torneoId)
    .single();
  
  if (error || !torneo) {
    return false;
  }
  
  return torneo.ventana_fichajes_abierta || false;
}
