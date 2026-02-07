-- Change ronda column type to text to support string identifiers like 'SF', 'F', 'Q'
DO $$
BEGIN
    -- Check if column exists and is integer before altering
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'partidos' 
        AND column_name = 'ronda' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE partidos ALTER COLUMN ronda TYPE VARCHAR;
    END IF;
END $$;
