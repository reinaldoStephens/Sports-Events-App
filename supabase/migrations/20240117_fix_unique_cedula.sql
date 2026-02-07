-- Add UNIQUE constraint to numero_cedula in deportistas table
-- This prevents duplicate cédulas across the entire system

ALTER TABLE public.deportistas
  ADD CONSTRAINT unique_numero_cedula UNIQUE (numero_cedula);

-- Note: This will fail if there are already duplicate cédulas in the table
-- To fix existing duplicates first, run:
-- SELECT numero_cedula, COUNT(*) 
-- FROM public.deportistas 
-- WHERE numero_cedula IS NOT NULL
-- GROUP BY numero_cedula 
-- HAVING COUNT(*) > 1;
