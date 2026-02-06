import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { getSupabaseAdmin } from '../lib/supabase';

const actionSupabase = getSupabaseAdmin();

export const updatePlayer = defineAction({
  accept: 'form',
  input: z.object({
    numero_cedula: z.string().min(9),
    nombre: z.string().min(1, "Nombre requerido"),
    nombre_deportivo: z.string().optional(),
    posicion: z.string().optional(),
    dorsal: z.number().int().min(1).max(99).optional(),
    equipo_id: z.string().uuid(),
  }),
  handler: async (input, context) => {
    if (!context.locals.user) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Debe iniciar sesión',
      });
    }

    // Verify user owns this team or is Admin
    const { data: team } = await actionSupabase
      .from('equipos')
      .select('delegado_id, bloqueado_edicion')
      .eq('id', input.equipo_id)
      .single();

    let isAllowed = false;
    let isAdmin = false;

    if (team) {
        if (team.delegado_id === context.locals.user.id) isAllowed = true;
        else {
             const { data: profile } = await actionSupabase.from('profiles').select('role').eq('id', context.locals.user.id).single();
             if (profile?.role === 'admin') {
                 isAllowed = true;
                 isAdmin = true;
             }
        }
    }

    if (!isAllowed || !team) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'No puedes modificar jugadores de este equipo',
      });
    }

    // Check if team is locked (Admins override)
    if (team.bloqueado_edicion && !isAdmin) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'El equipo está bloqueado y no se pueden editar jugadores',
      });
    }

    // Verify player belongs to this team
    const { data: player } = await actionSupabase
      .from('deportistas')
      .select('equipo_id')
      .eq('numero_cedula', input.numero_cedula)
      .single();

    if (!player || player.equipo_id !== input.equipo_id) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: 'Jugador no encontrado en este equipo',
      });
    }

    // Verify dorsal is unique (if provided and changed)
    if (input.dorsal) {
      const { data: existingDorsal } = await actionSupabase
        .from('deportistas')
        .select('numero_cedula')
        .eq('equipo_id', input.equipo_id)
        .eq('dorsal', input.dorsal)
        .neq('numero_cedula', input.numero_cedula)
        .maybeSingle();

      if (existingDorsal) {
        throw new ActionError({
          code: 'CONFLICT',
          message: `El dorsal ${input.dorsal} ya está en uso`,
        });
      }
    }

    // Update player
    const { error } = await actionSupabase
      .from('deportistas')
      .update({
        nombre: input.nombre,
        nombre_deportivo: input.nombre_deportivo || null,
        posicion: input.posicion || null,
        dorsal: input.dorsal || null,
      })
      .eq('numero_cedula', input.numero_cedula);

    if (error) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }

    return { success: true };
  },
});

export const deletePlayer = defineAction({
  accept: 'form',
  input: z.object({
    numero_cedula: z.string().min(9),
    equipo_id: z.string().uuid(),
  }),
  handler: async (input, context) => {
    if (!context.locals.user) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Debe iniciar sesión',
      });
    }

    // Verify user owns this team or is Admin
    const { data: team } = await actionSupabase
      .from('equipos')
      .select('delegado_id, bloqueado_edicion, capitan_id')
      .eq('id', input.equipo_id)
      .single();

    let isAllowed = false;
    let isAdmin = false;

    if (team) {
        if (team.delegado_id === context.locals.user.id) isAllowed = true;
        else {
             const { data: profile } = await actionSupabase.from('profiles').select('role').eq('id', context.locals.user.id).single();
             if (profile?.role === 'admin') {
                 isAllowed = true;
                 isAdmin = true;
             }
        }
    }

    if (!isAllowed || !team) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'No puedes modificar jugadores de este equipo',
      });
    }

    // Check if team is locked (Admins override lock)
    if (team.bloqueado_edicion && !isAdmin) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'El equipo está bloqueado y no se pueden eliminar jugadores',
      });
    }

    // If player is captain, unassign first
    if (team.capitan_id === input.numero_cedula) {
      await actionSupabase
        .from('equipos')
        .update({ capitan_id: null })
        .eq('id', input.equipo_id);
    }

    // Delete player
    const { error } = await actionSupabase
      .from('deportistas')
      .delete()
      .eq('numero_cedula', input.numero_cedula)
      .eq('equipo_id', input.equipo_id);

    if (error) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }

    return { success: true };
  },
});
