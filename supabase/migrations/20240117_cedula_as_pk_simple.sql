-- ============================================
-- OPCIÓN 1 (SIMPLE): DROP Y RECREAR
-- Para desarrollo - BORRA TODOS LOS DATOS
-- ============================================

-- 1. Eliminar FK que dependen de deportistas
ALTER TABLE jugador_estadisticas
    DROP CONSTRAINT IF EXISTS fk_jugador_cedula;

-- 2. Eliminar tabla deportistas (CASCADE elimina dependencias)
DROP TABLE IF EXISTS deportistas CASCADE;

-- 3. Recrear con cédula como PRIMARY KEY
CREATE TABLE deportistas (
    numero_cedula TEXT PRIMARY KEY CHECK (LENGTH(numero_cedula) IN (9, 11, 12)),
    nombre TEXT NOT NULL,
    nombre_deportivo TEXT,
    fecha_nacimiento DATE NOT NULL,
    edad INTEGER,
    posicion TEXT,
    dorsal INTEGER CHECK (dorsal >= 1 AND dorsal <= 99),
    equipo_id UUID REFERENCES equipos(id) ON DELETE CASCADE,
    creado_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_dorsal_per_team UNIQUE (equipo_id, dorsal)
);

-- 4. Recrear trigger de edad auto-calculada
CREATE OR REPLACE FUNCTION update_deportista_edad()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fecha_nacimiento IS NOT NULL THEN
    NEW.edad := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.fecha_nacimiento))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_deportista_edad ON deportistas;
CREATE TRIGGER trigger_update_deportista_edad
    BEFORE INSERT OR UPDATE OF fecha_nacimiento ON deportistas
    FOR EACH ROW
    EXECUTE FUNCTION update_deportista_edad();

-- 5. Agregar FK en jugador_estadisticas
ALTER TABLE jugador_estadisticas
    ADD CONSTRAINT fk_jugador_cedula 
    FOREIGN KEY (jugador_cedula) 
    REFERENCES deportistas(numero_cedula) 
    ON DELETE CASCADE;

-- 6. Crear índices para performance
CREATE INDEX idx_deportistas_equipo ON deportistas(equipo_id);
CREATE INDEX idx_deportistas_dorsal ON deportistas(equipo_id, dorsal);

-- 7. Configurar RLS (Row Level Security)
ALTER TABLE deportistas ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede ver jugadores (público)
DROP POLICY IF EXISTS "Anyone can view players" ON deportistas;
CREATE POLICY "Anyone can view players"
ON deportistas
FOR SELECT
USING (true);

-- Política: Usuarios autenticados pueden insertar
DROP POLICY IF EXISTS "Authenticated users can insert players" ON deportistas;
CREATE POLICY "Authenticated users can insert players"
ON deportistas
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Política: Delegados pueden actualizar jugadores de su equipo
DROP POLICY IF EXISTS "Delegados can update their players" ON deportistas;
CREATE POLICY "Delegados can update their players"
ON deportistas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM equipos
    WHERE equipos.id = deportistas.equipo_id
    AND equipos.delegado_id = auth.uid()
  )
);

-- Política: Delegados pueden eliminar jugadores de su equipo
DROP POLICY IF EXISTS "Delegados can delete their players" ON deportistas;
CREATE POLICY "Delegados can delete their players"
ON deportistas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM equipos
    WHERE equipos.id = deportistas.equipo_id
    AND equipos.delegado_id = auth.uid()
  )
);

-- 8. Agregar comentarios
COMMENT ON TABLE deportistas IS 'Jugadores registrados - PK es cédula';
COMMENT ON COLUMN deportistas.numero_cedula IS 'Cédula nacional (9 dígitos) o DIMEX (11-12 dígitos)';
COMMENT ON COLUMN deportistas.nombre_deportivo IS 'Nombre público para proteger privacidad';

SELECT 'Migración completada! Todos los datos de deportistas fueron eliminados y RLS configurado.' AS status;
