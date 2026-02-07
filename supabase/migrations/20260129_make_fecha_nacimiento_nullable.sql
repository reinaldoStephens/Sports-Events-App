-- Make fecha_nacimiento nullable to support optional birth dates
-- This allows importing players without birth dates from Excel

ALTER TABLE deportistas ALTER COLUMN fecha_nacimiento DROP NOT NULL;

-- Update comment to reflect that fecha_nacimiento is now optional
COMMENT ON COLUMN deportistas.fecha_nacimiento IS 'Fecha de nacimiento del jugador (opcional). La edad se calcula automáticamente si se proporciona.';

SELECT 'fecha_nacimiento is now nullable' AS status;
