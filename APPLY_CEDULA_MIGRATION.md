# Aplicar Migración: Cédula como Primary Key

## Paso 1: Ejecutar en Supabase

1. Ve a tu **Supabase Dashboard**
2. Click en **SQL Editor**
3. Click en **New Query**
4. Copia y pega el contenido del archivo:
   [`20240117_cedula_as_pk_simple.sql`](file:///c:/Users/reina/Documents/Practice/Astro/sports-events-app/supabase/migrations/20240117_cedula_as_pk_simple.sql)
5. Click en **Run** (Ctrl+Enter)

## Paso 2: Verificar

Después de ejecutar, verifica que todo funcionó:

```sql
-- Ver estructura de la tabla
\d deportistas

-- Verificar que cédula es PK
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'deportistas';

-- Verificar constraints
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'deportistas'::regclass;
```

Deberías ver:
- ✅ `numero_cedula` como PRIMARY KEY
- ✅ `unique_dorsal_per_team` constraint
- ✅ FK en `jugador_estadisticas`

## Paso 3: Prueba

1. Ve a `/delegado/equipo`
2. Agrega un jugador con cédula `123456789`
3. Intenta agregar otro jugador con la **misma cédula**
4. Deberías ver: "La cédula 123456789 ya está registrada en el sistema"

## ¿Qué Cambió?

✅ **Cédula es ahora PK** - No más UUIDs
✅ **Imposible duplicados** - Base de datos lo previene
✅ **Mejor performance** - Menos índices necesarios
✅ **Código más simple** - No necesitas buscar por UUID

## Si Algo Sale Mal

Si ves errores:
1. Compárteme el mensaje de error exacto
2. No te preocupes - podemos revertir fácilmente
3. La migración es segura porque estamos en desarrollo

## Próximo Paso

Una vez aplicada la migración exitosamente, **el sistema seguirá funcionando igual** porque:
- Las acciones ya usan `numero_cedula`
- Las queries en las páginas ya buscan por `equipo_id`
- No hay código que dependa del UUID `id`

💡 **Tip:** Después de la migración, puedes agregar jugadores de prueba nuevamente.
