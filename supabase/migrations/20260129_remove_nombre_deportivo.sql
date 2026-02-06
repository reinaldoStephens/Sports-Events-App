-- Remove nombre_deportivo column from deportistas table
-- This field is no longer needed as we'll use the 'nombre' field for all purposes

ALTER TABLE deportistas DROP COLUMN IF EXISTS nombre_deportivo;

-- Update comment for table to reflect changes
COMMENT ON TABLE deportistas IS 'Jugadores registrados - PK es cédula. Campo nombre_deportivo removido para simplificar.';

SELECT 'nombre_deportivo column removed successfully' AS status;
