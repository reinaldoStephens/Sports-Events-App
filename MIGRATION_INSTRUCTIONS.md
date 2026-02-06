# Applying Multi-Sport Migration

## Migration Status

✅ **Migration File Created**: `supabase/migrations/20240129_multi_sport_support.sql`

## Steps to Apply Migration

### Option 1: Supabase Dashboard (Recommended for existing projects)

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New query**
4. Copy the entire contents of `supabase/migrations/20240129_multi_sport_support.sql`
5. Paste into the SQL editor
6. Click **Run** to execute the migration
7. Verify success in the output panel

### Option 2: Supabase CLI (For local/automated deployment)

```powershell
# Make sure you're in the project directory
cd c:\Users\reina\Documents\Practice\Astro\sports-events-app

# Link to your Supabase project (if not already linked)
npx supabase link --project-id YOUR_PROJECT_ID

# Apply the migration
npx supabase db push
```

### Option 3: Manual Application via psql

If you have direct PostgreSQL access:

```powershell
psql -h YOUR_DB_HOST -U postgres -d postgres -f supabase/migrations/20240129_multi_sport_support.sql
```

## Post-Migration Steps

### 1. Regenerate TypeScript Types

After the migration succeeds, regenerate the TypeScript types:

```powershell
# Get your project ID from Supabase dashboard
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

This will fix the current TypeScript error: `File 'database.types.ts' is not a module`

### 2. Verify Database Changes

Check that the following changes were applied:

**`deportes` table:**
```sql
SELECT * FROM public.deportes;
```
Should show 4 sports: Fútbol, Volleyball, Basketball, Beisbol

**`torneos` table:**
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'torneos' AND column_name = 'deporte_id';
```
Should show `deporte_id` column as UUID

**`partidos` table:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'partidos' AND column_name IN ('puntos_local', 'puntos_visitante', 'detalles_partido', 'torneo_id');
```
Should show all 4 columns (goles renamed to puntos)

**`equipos` table:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'equipos' AND column_name IN ('director_tecnico', 'asistente_tecnico');
```
Should show both column names

**`jugador_estadisticas` table:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'jugador_estadisticas' AND column_name = 'puntos';
```
Should show `puntos` (renamed from `goles`)

### 3. Test Development Server

```powershell
npm run dev
```

The server should start without TypeScript errors (after types are regenerated).

## Changes Made in Migration

### Database Tables Modified

1. **`deportes`** - Created/verified with 4 sports
2. **`torneos`** - Added `deporte_id` column
3. **`partidos`** - Renamed scoring fields, added `detalles_partido` and `torneo_id`
4. **`equipos`** - Added `director_tecnico` and `asistente_tecnico`
5. **`jugador_estadisticas`** - Renamed `goles` to `puntos`

### Backend Code Updated

1. **`src/actions/index.ts`**:
   - `createTournament`: deporte_id now required + validation
   - `updateMatchResult`: uses puntos_local/puntos_visitante
   - `createTeamStandalone`: accepts director_tecnico/asistente_tecnico

2. **`src/lib/standings.ts`**: 
   - Uses puntos_local/puntos_visitante
   - Sport-aware point calculations
   - Generic stats (pf/pc/dp)

3. **`src/lib/sport-config.ts`**: 
   - New sport configuration library
   - Scoring labels per sport
   - Point system configurations

## Known Issues & Next Steps

### ⚠️ Remaining Tasks

The following files still need updates (they still reference old `goles` fields):

**UI Components:**
- `src/pages/admin/torneo/[id].astro` - Match result modal
- `src/pages/torneo/[id].astro` - Public match display
- `src/components/StandingsTable.astro` - Standings headers
- `src/components/MatchCard.astro` - Match card display
- `src/pages/admin/dashboard.astro` - Tournament creation form (needs sport dropdown)

**Statistics Page:**
- `src/pages/estadisticas/goleadores.astro` - Needs refactoring to use `jugador_estadisticas`

**Actions:**
- `src/actions/self-service.ts` - May contain goles references
- `src/actions/self-service-actions-REFERENCE.ts` - Reference file

These updates are required for the UI to display correctly with the new schema.

## Rollback Plan

If you need to revert the migration:

```sql
-- Revert coaching staff
ALTER TABLE public.equipos DROP COLUMN IF EXISTS director_tecnico;
ALTER TABLE public.equipos DROP COLUMN IF EXISTS asistente_tecnico;

-- Revert partidos
ALTER TABLE public.partidos DROP COLUMN IF EXISTS torneo_id;
ALTER TABLE public.partidos DROP COLUMN IF EXISTS detalles_partido;
ALTER TABLE public.partidos RENAME COLUMN puntos_local TO goles_local;
ALTER TABLE public.partidos RENAME COLUMN puntos_visitante TO goles_visitante;

-- Revert jugador_estadisticas
ALTER TABLE public.jugador_estadisticas RENAME COLUMN puntos TO goles;

-- Revert torneos
ALTER TABLE public.torneos DROP COLUMN IF EXISTS deporte_id;

-- Keep deportes table (no harm in keeping it)
```

## Support

If you encounter issues during migration:
1. Check Supabase dashboard logs for detailed error messages
2. Verify all prerequisite tables exist (torneos, partidos, equipos, jugador_estadisticas)
3. Ensure you have admin permissions on the database
4. Check for existing data that might conflict with new constraints
