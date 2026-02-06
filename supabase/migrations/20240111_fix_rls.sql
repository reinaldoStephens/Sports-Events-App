-- Enable RLS on tables if not already enabled (redundant but safe)
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous read access to specific tables
-- (Adjusting generic read policy for ease of development/public view)
CREATE POLICY "Public can view jornadas" ON public.jornadas FOR SELECT USING (true);
CREATE POLICY "Public can view partidos" ON public.partidos FOR SELECT USING (true);
CREATE POLICY "Public can view equipos" ON public.equipos FOR SELECT USING (true);
CREATE POLICY "Public can view noticias" ON public.noticias FOR SELECT USING (true);

-- Policy: Allow authenticated users (or admins) to insert/update/delete
-- Using simplified check for auth.uid() NOT NULL for basic authenticated access
CREATE POLICY "Admins can manage jornadas" ON public.jornadas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage partidos" ON public.partidos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage equipos" ON public.equipos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage noticias" ON public.noticias FOR ALL USING (auth.role() = 'authenticated');
