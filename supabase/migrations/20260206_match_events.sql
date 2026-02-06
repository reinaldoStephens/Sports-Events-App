-- Migration: Match Events System
-- Creates eventos_partido table for tracking match events (goals, cards, substitutions)
-- with player attribution and minute tracking

create table public.eventos_partido (
  id uuid not null default gen_random_uuid(),
  partido_id uuid not null references partidos(id) on delete cascade,
  tipo_evento text not null check (tipo_evento in ('gol', 'tarjeta_amarilla', 'tarjeta_roja', 'sustitucion')),
  minuto integer not null check (minuto >= 0 and minuto <= 120),
  jugador_cedula text not null references deportistas(numero_cedula) on delete cascade,
  equipo_id uuid not null references equipos(id) on delete cascade,
  detalles jsonb default '{}'::jsonb,
  creado_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint eventos_partido_pkey primary key (id)
);

-- Indexes for efficient queries
create index idx_eventos_partido_partido on public.eventos_partido(partido_id);
create index idx_eventos_partido_jugador on public.eventos_partido(jugador_cedula);
create index idx_eventos_partido_tipo on public.eventos_partido(tipo_evento);

-- Enable RLS
alter table public.eventos_partido enable row level security;

-- Public read access for match events
create policy "Public read access to match events" on public.eventos_partido
  for select using (true);

-- Admins can manage all match events
create policy "Admins can manage match events" on public.eventos_partido
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
