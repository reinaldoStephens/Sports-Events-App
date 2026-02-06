# Excel Import Specification - Player Rosters

## Overview

This document defines the Excel format for importing player rosters into teams. Team creation remains a manual process; this import is exclusively for adding multiple players to an existing team.

## Excel File Requirements

### File Format
- **Extension**: `.xlsx` (Excel 2007+) or `.csv`
- **Encoding**: UTF-8 (for CSV)
- **Max Rows**: 500 players per import
- **Max File Size**: 5MB

### Required Columns

| Column Name | Type | Required | Validation | Example |
|------------|------|----------|------------|---------|
| `numero_cedula` | Text | ✅ Yes | 9 digits, numeric | `123456789` |
| `nombre` | Text | ✅ Yes | 3-100 characters | `Juan Pérez Gómez` |
| `fecha_nacimiento` | Date | ✅ Yes | YYYY-MM-DD or DD/MM/YYYY | `1995-03-15` |
| `posicion` | Text | ❌ No | 1-50 characters | `Delantero` |
| `dorsal` | Number | ❌ No | 1-999, unique per team | `10` |
| `nombre_deportivo` | Text | ❌ No | 1-50 characters (for privacy) | `Juanchi` |

### Column Order
The columns can be in any order, as long as all required columns are present with exact header names (case-sensitive).

## Validation Rules

### Individual Row Validation

1. **Cédula (numero_cedula)**
   - Must be exactly 9 digits
   - Must be unique across the tournament (a player cannot be in two teams)
   - Must be unique in the import file (no duplicates)
   - Accepts DIMEX format (12 digits) for foreign players

2. **Nombre (nombre)**
   - Minimum 3 characters
   - Maximum 100 characters
   - Cannot be empty or only whitespace

3. **Fecha de Nacimiento (fecha_nacimiento)**
   - Accepted formats: `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`
   - Player must be at least 10 years old
   - Player cannot be born in the future
   - Age is auto-calculated from this field

4. **Posición (posicion)** - Optional
   - Maximum 50 characters
   - Common values: `Portero`, `Defensa`, `Mediocampista`, `Delantero`, `Líbero`, `Armador`, etc.

5. **Dorsal (dorsal)** - Optional
   - Integer between 1 and 999
   - Must be unique within the team
   - If duplicate found, import fails for that row

6. **Nombre Deportivo (nombre_deportivo)** - Optional
   - Maximum 50 characters
   - Used for public display instead of real name (privacy)

### Team-Level Validation

- Maximum 30 players per team (configurable)
- No duplicate cédulas within the import
- All dorsales must be unique

### Tournament-Level Validation

- Player (by cédula) cannot exist in another team in the same tournament
- If player already exists in team, row is skipped (not imported)

## Example Excel Template

### Option 1: Minimal (Required Only)

```
numero_cedula | nombre              | fecha_nacimiento
123456789     | Juan Pérez Gómez    | 1995-03-15
987654321     | María López Soto    | 1998-07-22
456789123     | Carlos Ruiz Castro  | 2000-11-05
```

### Option 2: Complete (All Fields)

```
numero_cedula | nombre              | fecha_nacimiento | posicion      | dorsal | nombre_deportivo
123456789     | Juan Pérez Gómez    | 1995-03-15       | Delantero     | 10     | Juanchi
987654321     | María López Soto    | 1998-07-22       | Portera       | 1      | Mary
456789123     | Carlos Ruiz Castro  | 2000-11-05       | Mediocampista | 8      | Carlitos
```

## Import Process Flow

1. **User uploads Excel file** from team management page
2. **File validation**: Check format, size, encoding
3. **Header validation**: Verify all required columns exist
4. **Row-by-row processing**:
   - Parse and validate each field
   - Check for duplicate cédulas in file
   - Check if player exists in tournament
   - Check if dorsal is unique in team
5. **Results summary**:
   - ✅ Successfully imported: X players
   - ⚠️ Skipped (already exist): Y players
   - ❌ Failed (validation errors): Z players
6. **Error report**: Download CSV with failed rows and error messages

## Error Messages

| Error Code | Message | Resolution |
|-----------|---------|------------|
| `INVALID_CEDULA` | Cédula must be 9 digits | Fix format in Excel |
| `DUPLICATE_CEDULA_FILE` | Duplicate cédula in import file | Remove duplicate row |
| `DUPLICATE_CEDULA_TOURNAMENT` | Player already exists in another team | Remove from import |
| `INVALID_DATE` | Invalid birth date format | Use YYYY-MM-DD |
| `PLAYER_TOO_YOUNG` | Player must be at least 10 years old | Verify birth date |
| `DUPLICATE_DORSAL` | Dorsal number already used in team | Change dorsal number |
| `INVALID_NAME` | Name must be 3-100 characters | Fix player name |

## Future Enhancements

- [ ] Support for .csv files
- [ ] Auto-detect column names (fuzzy matching)
- [ ] Support for multiple languages (column headers)
- [ ] Bulk update (re-import to update existing players)
- [ ] Photo upload via URL column
- [ ] Medical info fields (blood type, allergies)
