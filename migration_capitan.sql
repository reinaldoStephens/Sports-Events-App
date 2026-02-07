-- The previous error indicates that the target 'deportistas' table likely uses 'numero_cedula' (text) as its Primary Key, or we are trying to link to it.
-- We will change 'capitan_id' to be type TEXT and reference 'public.deportistas(numero_cedula)'.

ALTER TABLE public.equipos 
DROP COLUMN IF EXISTS capitan_id;

ALTER TABLE public.equipos 
ADD COLUMN capitan_id text REFERENCES public.deportistas(numero_cedula) ON DELETE SET NULL;

COMMENT ON COLUMN public.equipos.capitan_id IS 'Cédula of the team captain';
