-- ============================================
-- MULTI-TEAM PLAYER SUPPORT MIGRATION
-- Allows players to belong to multiple teams
-- ============================================

-- Step 1: Create junction table for many-to-many relationship
CREATE TABLE equipo_deportistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  deportista_cedula TEXT NOT NULL REFERENCES deportistas(numero_cedula) ON DELETE CASCADE,
  dorsal INTEGER CHECK (dorsal >= 1 AND dorsal <= 99),
  posicion TEXT,
  es_capitan BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT unique_player_per_team UNIQUE (equipo_id, deportista_cedula),
  CONSTRAINT unique_dorsal_per_team UNIQUE (equipo_id, dorsal)
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_equipo_deportistas_equipo ON equipo_deportistas(equipo_id);
CREATE INDEX idx_equipo_deportistas_deportista ON equipo_deportistas(deportista_cedula);
CREATE INDEX idx_equipo_deportistas_dorsal ON equipo_deportistas(equipo_id, dorsal);

-- Partial unique index to ensure only one captain per team
CREATE UNIQUE INDEX idx_one_captain_per_team 
  ON equipo_deportistas(equipo_id) 
  WHERE es_capitan = TRUE;

-- Step 3: Migrate existing data from deportistas to junction table
INSERT INTO equipo_deportistas (equipo_id, deportista_cedula, dorsal, posicion, es_capitan)
SELECT 
  d.equipo_id,
  d.numero_cedula,
  d.dorsal,
  d.posicion,
  (e.capitan_id = d.numero_cedula) as es_capitan
FROM deportistas d
LEFT JOIN equipos e ON e.id = d.equipo_id
WHERE d.equipo_id IS NOT NULL;

-- Step 4: Create validation function for captain
CREATE OR REPLACE FUNCTION validate_capitan_in_team()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.capitan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM equipo_deportistas
      WHERE equipo_id = NEW.id
      AND deportista_cedula = NEW.capitan_id
    ) THEN
      RAISE EXCEPTION 'El capitán debe ser un jugador del equipo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add trigger to validate captain on team updates
DROP TRIGGER IF EXISTS trigger_validate_capitan ON equipos;
CREATE TRIGGER trigger_validate_capitan
  BEFORE INSERT OR UPDATE OF capitan_id ON equipos
  FOR EACH ROW
  EXECUTE FUNCTION validate_capitan_in_team();

-- Step 6: Drop old constraints and columns from deportistas
ALTER TABLE deportistas 
  DROP CONSTRAINT IF EXISTS deportistas_equipo_id_fkey;

DROP INDEX IF EXISTS idx_deportistas_equipo;
DROP INDEX IF EXISTS idx_deportistas_dorsal;

ALTER TABLE deportistas 
  DROP COLUMN IF EXISTS equipo_id,
  DROP COLUMN IF EXISTS dorsal,
  DROP COLUMN IF EXISTS posicion;

-- Step 7: Configure RLS for equipo_deportistas
ALTER TABLE equipo_deportistas ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view player-team relationships (public)
CREATE POLICY "Anyone can view player-team relationships"
ON equipo_deportistas
FOR SELECT
USING (true);

-- Policy: Only authenticated users can insert (admin only for now)
CREATE POLICY "Authenticated users can add players to teams"
ON equipo_deportistas
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can update (admin only for now)
CREATE POLICY "Authenticated users can update player-team relationships"
ON equipo_deportistas
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Policy: Only authenticated users can delete (admin only for now)
CREATE POLICY "Authenticated users can remove players from teams"
ON equipo_deportistas
FOR DELETE
USING (auth.role() = 'authenticated');

-- Step 8: Add comments for documentation
COMMENT ON TABLE equipo_deportistas IS 'Junction table for many-to-many relationship between teams and players';
COMMENT ON COLUMN equipo_deportistas.dorsal IS 'Jersey number - team specific';
COMMENT ON COLUMN equipo_deportistas.posicion IS 'Player position - can vary by team';
COMMENT ON COLUMN equipo_deportistas.es_capitan IS 'Captain flag - only one per team';

COMMENT ON TABLE deportistas IS 'Players registry - personal information only. Team relationships in equipo_deportistas.';

SELECT 'Migration completed! Players can now belong to multiple teams.' AS status;

