-- Cleanup script: Delete all jornadas for the tournament that failed
DELETE FROM jornadas WHERE torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';

-- Verify deletion
SELECT COUNT(*) as jornadas_remaining FROM jornadas WHERE torneo_id = 'c16862f2-9689-4871-bc94-ad206ec9dd8b';
