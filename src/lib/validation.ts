/**
 * Costa Rican Identity and Data Validation Utilities
 * 
 * Provides validation functions for:
 * - Cédula (Costa Rican National ID - 9 digits)
 * - DIMEX (Foreign ID - 11-12 digits)
 * - Phone numbers (Costa Rica format - 8 digits)
 * - Dorsal (jersey number) uniqueness
 * - Age calculation
 * - Privacy sanitization (remove sensitive data from public views)
 */

import { supabase } from './supabase';

/**
 * Validates Costa Rican cédula format
 * Format: 9 digits, can be formatted as 1-0234-0567 or 102340567
 * @param cedula - The cédula to validate
 * @returns true if valid, false otherwise
 */
export function validateCedula(cedula: string): boolean {
  if (!cedula) return false;
  
  // Remove hyphens and spaces
  const cleaned = cedula.replace(/[-\s]/g, '');
  
  // Must be exactly 9 digits
  if (!/^\d{9}$/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Validates DIMEX (foreign ID) format
 * Format: 11-12 digits
 * @param dimex - The DIMEX to validate
 * @returns true if valid, false otherwise
 */
export function validateDIMEX(dimex: string): boolean {
  if (!dimex) return false;
  
  // Remove hyphens and spaces
  const cleaned = dimex.replace(/[-\s]/g, '');
  
  // Must be 11 or 12 digits
  if (!/^\d{11,12}$/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Validates either cédula or DIMEX
 * @param id - The identification number to validate
 * @returns true if valid cédula or DIMEX, false otherwise
 */
export function validateIdentification(id: string): boolean {
  return validateCedula(id) || validateDIMEX(id);
}

/**
 * Formats cédula with hyphens for display
 * @param cedula - The cédula to format
 * @returns formatted cédula (e.g., 1-0234-0567)
 */
export function formatCedula(cedula: string): string {
  if (!cedula) return '';
  
  const cleaned = cedula.replace(/[-\s]/g, '');
  
  if (cleaned.length === 9) {
    return `${cleaned[0]}-${cleaned.slice(1, 5)}-${cleaned.slice(5)}`;
  }
  
  return cedula;
}

/**
 * Validates Costa Rican phone number format
 * Format: 8 digits (e.g., 8765-4321 or 87654321)
 * @param phone - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove hyphens, spaces, and parentheses
  const cleaned = phone.replace(/[-\s()]/g, '');
  
  // Must be exactly 8 digits
  if (!/^\d{8}$/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Calculates age from birth date
 * @param birthDate - The birth date
 * @returns age in years
 */
export function calculateAge(birthDate: Date | string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Validates that a dorsal (jersey number) is unique within a team
 * @param dorsal - The dorsal number (1-99)
 * @param teamId - The team ID
 * @param excludeCedula - Optional cédula to exclude from check (for updates)
 * @returns Promise<boolean> - true if available, false if already taken
 */
export async function validateDorsal(
  dorsal: number,
  teamId: string,
  excludeCedula?: string
): Promise<boolean> {
  if (!dorsal || dorsal < 1 || dorsal > 99) {
    return false;
  }
  
  let query = supabase
    .from('deportistas')
    .select('numero_cedula')
    .eq('equipo_id', teamId)
    .eq('dorsal', dorsal);
  
  if (excludeCedula) {
    query = query.neq('numero_cedula', excludeCedula);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error validating dorsal:', error);
    return false;
  }
  
  return data.length === 0;
}

/**
 * Validates dorsal number range
 * @param dorsal - The dorsal number
 * @returns true if in valid range (1-99), false otherwise
 */
export function validateDorsalRange(dorsal: number): boolean {
  return Number.isInteger(dorsal) && dorsal >= 1 && dorsal <= 99;
}

/**
 * Sanitizes data for public display by removing sensitive information
 * @param data - The data object to sanitize
 * @returns sanitized data without cédula and phone numbers
 */
export function sanitizeForPublic<T extends Record<string, any>>(data: T): Partial<T> {
  if (!data) return data;
  
  const sensitiveFields = ['numero_cedula', 'telefono_contacto', 'fecha_nacimiento'];
  const sanitized = { ...data };
  
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });
  
  return sanitized;
}

/**
 * Gets display name for a player (nombre_deportivo if set, otherwise nombre)
 * @param player - The player object
 * @returns display name
 */
export function getPlayerDisplayName(player: {
  nombre: string;
  nombre_deportivo?: string | null;
}): string {
  return player.nombre_deportivo || player.nombre;
}

/**
 * Formats phone number for display
 * @param phone - The phone number
 * @returns formatted phone (e.g., 8765-4321)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[-\s()]/g, '');
  
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  
  return phone;
}

/**
 * Validates that all required fields for a player are present
 * @param player - Partial player object
 * @returns validation result with errors
 */
export function validatePlayerData(player: {
  numero_cedula?: string;
  nombre?: string;
  fecha_nacimiento?: Date | string;
  dorsal?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!player.numero_cedula) {
    errors.push('Número de cédula es requerido');
  } else if (!validateIdentification(player.numero_cedula)) {
    errors.push('Formato de cédula inválido (debe ser 9 dígitos para cédula o 11-12 para DIMEX)');
  }
  
  if (!player.nombre || player.nombre.trim().length === 0) {
    errors.push('Nombre es requerido');
  }
  
  if (!player.fecha_nacimiento) {
    errors.push('Fecha de nacimiento es requerida');
  } else {
    const age = calculateAge(player.fecha_nacimiento);
    if (age < 5 || age > 100) {
      errors.push('Edad calculada fuera de rango válido');
    }
  }
  
  if (player.dorsal !== undefined && !validateDorsalRange(player.dorsal)) {
    errors.push('Dorsal debe estar entre 1 y 99');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates team data
 * @param team - Partial team object
 * @returns validation result with errors
 */
export function validateTeamData(team: {
  nombre?: string;
  direccion_cancha?: string;
  telefono_contacto?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!team.nombre || team.nombre.trim().length === 0) {
    errors.push('Nombre del equipo es requerido');
  }
  
  if (!team.direccion_cancha || team.direccion_cancha.trim().length === 0) {
    errors.push('Dirección de la cancha es requerida');
  }
  
  if (team.telefono_contacto && !validatePhoneNumber(team.telefono_contacto)) {
    errors.push('Formato de teléfono inválido (debe ser 8 dígitos)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
