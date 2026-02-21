-- Migration: Add Coaching Staff to Teams
-- Description: Add fields for Director Técnico and Asistente Técnico
-- Date: 2026-02-09

-- Add coaching staff columns to equipos table
ALTER TABLE equipos
ADD COLUMN IF NOT EXISTS director_tecnico_cedula TEXT,
ADD COLUMN IF NOT EXISTS director_tecnico_nombre TEXT,
ADD COLUMN IF NOT EXISTS asistente_tecnico_cedula TEXT,
ADD COLUMN IF NOT EXISTS asistente_tecnico_nombre TEXT;

-- Add comments for documentation
COMMENT ON COLUMN equipos.director_tecnico_cedula IS 'Cédula del Director Técnico del equipo';
COMMENT ON COLUMN equipos.director_tecnico_nombre IS 'Nombre completo del Director Técnico';
COMMENT ON COLUMN equipos.asistente_tecnico_cedula IS 'Cédula del Asistente Técnico del equipo';
COMMENT ON COLUMN equipos.asistente_tecnico_nombre IS 'Nombre completo del Asistente Técnico';
