-- check the structure of eventos_partido table
-- by selecting one row
SELECT * FROM eventos_partido LIMIT 1;

-- Also verify if there are any events for the matches in question
-- Assuming the matches are recently updated or pending
SELECT * FROM eventos_partido 
WHERE partido_id IN (
    SELECT id FROM partidos WHERE torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
);

