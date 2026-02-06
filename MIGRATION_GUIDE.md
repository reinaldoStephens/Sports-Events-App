# Pasos para Aplicar la Migración de Base de Datos

## Opción 1: Dashboard de Supabase (Recomendado)

1. **Ir a Supabase Dashboard**
   - Abre https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Abrir SQL Editor**
   - En el menú lateral, click en "SQL Editor"
   - Click en "New Query"

3. **Ejecutar la Migración**
   - Abre el archivo [`20240117_simplified_migration.sql`](file:///c:/Users/reina/Documents/Practice/Astro/sports-events-app/supabase/migrations/20240117_simplified_migration.sql)
   - Copia TODO el contenido
   - Pégalo en el SQL Editor
   - Click en "Run" (Ctrl+Enter)

4. **Verificar Resultado**
   - Deberías ver el mensaje: "Migration completed successfully!"
   - Si hay errores, cópialos y compártelos conmigo

## Opción 2: Por Secciones (Si tienes errores)

Si la migración completa falla, ejecuta sección por sección:

### Sección 1: Nuevas Columnas
```sql
ALTER TABLE public.equipos 
  ADD COLUMN IF NOT EXISTS delegado_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS telefono_contacto TEXT,
  ADD COLUMN IF NOT EXISTS direccion_cancha TEXT,
  ADD COLUMN IF NOT EXISTS bloqueado_edicion BOOLEAN DEFAULT false;

ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS inscripciones_bloqueadas BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ventana_fichajes_abierta BOOLEAN DEFAULT false;
```

### Sección 2: Tipo ENUM + Torneo Participantes
```sql
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participation_status') THEN
    CREATE TYPE participation_status AS ENUM ('pendiente', 'en_revision', 'aprobado', 'rechazado');
  END IF;
END $$;

ALTER TABLE public.torneo_participantes
  ADD COLUMN IF NOT EXISTS status participation_status DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS notas_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES auth.users(id);
```

### Sección 3: Tabla de Estadísticas
```sql
CREATE TABLE IF NOT EXISTS public.jugador_estadisticas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jugador_cedula TEXT NOT NULL,
  torneo_id UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  goles INTEGER DEFAULT 0,
  amarillas INTEGER DEFAULT 0,
  rojas INTEGER DEFAULT 0,
  partidos_jugados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### Sección 4: Deportistas (Cédula)
```sql
ALTER TABLE public.deportistas
  ADD COLUMN IF NOT EXISTS numero_cedula TEXT,
  ADD COLUMN IF NOT EXISTS nombre_deportivo TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS edad INTEGER,
  ADD COLUMN IF NOT EXISTS dorsal INTEGER;

ALTER TABLE public.deportistas
  ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES public.equipos(id) ON DELETE CASCADE;
```

### Sección 5: Funciones y Triggers
Ejecuta el resto del archivo SQL para crear las funciones de cálculo de edad y triggers.

## ¿Qué Cambios Verás?

Después de ejecutar la migración:

✅ **Tabla `equipos`** tendrá:
- `delegado_id` - Dueño del equipo
- `direccion_cancha` - Dirección de la cancha
- `bloqueado_edicion` - Estado de bloqueo

✅ **Tabla `torneos`** tendrá:
- `inscripciones_bloqueadas` - Control global
- `ventana_fichajes_abierta` - Ventana de fichajes

✅ **Tabla `torneo_participantes`** tendrá:
- `status` - Estado de aprobación
- `notas_rechazo` - Comentarios del admin

✅ **Nueva tabla `jugador_estadisticas`**
- Para rastrear goles, tarjetas, etc.

✅ **Tabla `deportistas`** tendrá:
- `numero_cedula` - Cédula como identificador
- `fecha_nacimiento` + `edad` auto-calculada
- `dorsal` - Número de camiseta

## Verificación

Después de la migración, ejecuta esto para verificar:

```sql
-- Ver nuevas columnas en equipos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'equipos' 
AND column_name IN ('delegado_id', 'direccion_cancha', 'bloqueado_edicion');

-- Ver status enum
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'participation_status'::regtype;

-- Ver tabla de estadísticas
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'jugador_estadisticas'
);
```

## Problemas Comunes

**Error: "column already exists"**
- Normal si ya ejecutaste parte de la migración
- Los `IF NOT EXISTS` deberían prevenirlo

**Error: "foreign key violation"**
- Puede ocurrir si hay datos existentes
- Compárteme el error específico

**Error: "permission denied"**
- Asegúrate de estar usando tu cuenta de admin en Supabase

## Siguiente Paso

Una vez ejecutada la migración con éxito, las nuevas acciones en `index.ts` funcionarán automáticamente. El servidor de desarrollo recargará y podrás usar:

- `actions.createTeamAsDelegado`
- `actions.addPlayerToTeam`
- `actions.submitTeamForReview`
- `actions.approveTeam`
- `actions.rejectTeam`
