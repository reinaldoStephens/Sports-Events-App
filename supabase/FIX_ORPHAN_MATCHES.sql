-- Cleanup script: Delete orphan matches
-- These are matches that belong to the tournament but have no assigned jornada (jornada_id IS NULL).
-- They are likely "Ghost Matches" left over from a previous operation or bad cleanup.

DELETE FROM partidos 
WHERE torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
AND jornada_id IS NULL;

-- Verify they are gone
SELECT COUNT(*) as remaining_orphans 
FROM partidos 
WHERE torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b'
AND jornada_id IS NULL;
