import * as XLSX from 'xlsx';

/**
 * Player data structure for Excel import
 */
export interface PlayerExcelRow {
  cedula: string;
  nombre: string;
  fecha_nacimiento?: string;
  posicion?: string;
  dorsal?: number;
}

/**
 * Validation result for a single player row
 */
export interface PlayerValidationResult {
  isValid: boolean;
  errors: string[];
  row: number;
  data?: PlayerExcelRow;
}

/**
 * Result of Excel parsing
 */
export interface ExcelParseResult {
  success: boolean;
  players: PlayerExcelRow[];
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
}

/**
 * Parse DD/MM/YYYY date string to Date object
 */
function parseDDMMYYYY(dateString: string): Date | null {
  if (!dateString) return null;
  
  const parts = dateString.trim().split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900) return null;
  
  const date = new Date(year, month, day);
  
  // Verify the date is valid
  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    return null;
  }
  
  return date;
}

/**
 * Format Date to YYYY-MM-DD for database
 */
function formatDateForDB(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate cedula format (9, 11, or 12 digits)
 */
function validateCedula(cedula: string): boolean {
  if (!cedula) return false;
  const cleanCedula = cedula.toString().trim();
  return /^\d{9}$|^\d{11}$|^\d{12}$/.test(cleanCedula);
}

/**
 * Validate a single player row
 */
export function validatePlayerRow(
  row: any,
  rowNumber: number
): PlayerValidationResult {
  const errors: string[] = [];
  
  // Required: cedula
  if (!row.cedula) {
    errors.push('Cédula es requerida');
  } else if (!validateCedula(row.cedula)) {
    errors.push('Cédula debe tener 9, 11 o 12 dígitos');
  }
  
  // Required: nombre
  if (!row.nombre || row.nombre.trim() === '') {
    errors.push('Nombre es requerido');
  }
  
  // Optional: fecha_nacimiento (must be DD/MM/YYYY if provided)
  let fechaNacimiento: string | undefined;
  if (row.fecha_nacimiento) {
    const dateStr = row.fecha_nacimiento.toString().trim();
    const parsedDate = parseDDMMYYYY(dateStr);
    if (!parsedDate) {
      errors.push('Fecha de nacimiento debe estar en formato DD/MM/YYYY');
    } else {
      fechaNacimiento = formatDateForDB(parsedDate);
    }
  }
  
  // Optional: dorsal (must be 1-99 if provided)
  if (row.dorsal !== undefined && row.dorsal !== null && row.dorsal !== '') {
    const dorsalNum = parseInt(row.dorsal, 10);
    if (isNaN(dorsalNum) || dorsalNum < 1 || dorsalNum > 99) {
      errors.push('Dorsal debe ser un número entre 1 y 99');
    }
  }
  
  const playerData: PlayerExcelRow = {
    cedula: row.cedula?.toString().trim(),
    nombre: row.nombre?.toString().trim(),
    fecha_nacimiento: fechaNacimiento,
    posicion: row.posicion?.toString().trim() || undefined,
    dorsal: row.dorsal ? parseInt(row.dorsal, 10) : undefined,
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    row: rowNumber,
    data: errors.length === 0 ? playerData : undefined,
  };
}

/**
 * Parse Excel file buffer to player data
 */
export function parseExcelToPlayers(buffer: ArrayBuffer): ExcelParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    const players: PlayerExcelRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const seenCedulas = new Set<string>();
    
    rawData.forEach((row: any, index) => {
      const rowNumber = index + 2; // +2 because Excel rows are 1-indexed and we have a header
      
      const validation = validatePlayerRow(row, rowNumber);
      
      if (!validation.isValid) {
        errors.push({
          row: rowNumber,
          message: validation.errors.join(', '),
        });
      } else if (validation.data) {
        // Check for duplicate cedula in the file
        if (seenCedulas.has(validation.data.cedula)) {
          errors.push({
            row: rowNumber,
            message: `Cédula duplicada: ${validation.data.cedula}`,
          });
        } else {
          seenCedulas.add(validation.data.cedula);
          players.push(validation.data);
        }
      }
    });
    
    return {
      success: errors.length === 0,
      players,
      errors,
      totalRows: rawData.length,
    };
  } catch (error) {
    return {
      success: false,
      players: [],
      errors: [{ row: 0, message: `Error al leer archivo Excel: ${error}` }],
      totalRows: 0,
    };
  }
}

/**
 * Generate a sample Excel template for download
 */
export function generatePlayerTemplate(): ArrayBuffer {
  const sampleData = [
    {
      cedula: '123456789',
      nombre: 'Juan Pérez García',
      fecha_nacimiento: '15/03/1995',
      posicion: 'Delantero',
      dorsal: 10,
    },
    {
      cedula: '987654321',
      nombre: 'María González López',
      fecha_nacimiento: '20/07/1998',
      posicion: 'Mediocampista',
      dorsal: 8,
    },
    {
      cedula: '456789123',
      nombre: 'Carlos Rodríguez Sánchez',
      fecha_nacimiento: '',
      posicion: 'Defensa',
      dorsal: 5,
    },
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Jugadores');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
