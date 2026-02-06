/**
 * Permission Utilities
 * 
 * Functions to check user permissions for team and player management:
 * - Delegado ownership validation
 * - Super admin role checks
 * - Team edit permissions
 */

import { supabase } from './supabase';

/**
 * Checks if a user is the delegado (owner) of a team
 * @param userId - The user ID to check
 * @param teamId - The team ID
 * @returns Promise<boolean> - true if user is the delegado
 */
export async function isDelegadoOfTeam(userId: string, teamId: string): Promise<boolean> {
  const { data: team, error } = await supabase
    .from('equipos')
    .select('delegado_id')
    .eq('id', teamId)
    .single();
  
  if (error || !team) {
    return false;
  }
  
  return team.delegado_id === userId;
}

/**
 * Checks if a user has super_admin role
 * @param userId - The user ID to check
 * @returns Promise<boolean> - true if user is super_admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !profile) {
    return false;
  }
  
  return profile.role === 'super_admin';
}

/**
 * Checks if a user has admin role (admin or super_admin)
 * @param userId - The user ID to check
 * @returns Promise<boolean> - true if user is admin or super_admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !profile) {
    return false;
  }
  
  return profile.role === 'admin' || profile.role === 'super_admin';
}

/**
 * Checks if a user can edit a team
 * User can edit if they are:
 * - The delegado of the team, OR
 * - A super_admin
 * @param userId - The user ID
 * @param teamId - The team ID
 * @returns Promise<boolean> - true if user can edit
 */
export async function canEditTeam(userId: string, teamId: string): Promise<boolean> {
  // Check if super_admin first (faster query)
  const superAdmin = await isSuperAdmin(userId);
  if (superAdmin) {
    return true;
  }
  
  // Check if delegado
  const delegado = await isDelegadoOfTeam(userId, teamId);
  return delegado;
}

/**
 * Gets the user's role
 * @param userId - The user ID
 * @returns Promise<string | null> - The user's role or null
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !profile) {
    return null;
  }
  
  return profile.role;
}

/**
 * Checks if a user can approve teams (admin or super_admin)
 * @param userId - The user ID
 * @returns Promise<boolean> - true if user can approve
 */
export async function canApproveTeams(userId: string): Promise<boolean> {
  return isAdmin(userId);
}

/**
 * Checks if a user can manage tournament settings (super_admin only)
 * @param userId - The user ID
 * @returns Promise<boolean> - true if user can manage tournament settings
 */
export async function canManageTournament(userId: string): Promise<boolean> {
  return isSuperAdmin(userId);
}
