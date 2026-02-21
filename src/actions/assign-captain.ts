import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { getSupabaseAdmin } from '../lib/supabase';

const actionSupabase = getSupabaseAdmin();

export const assignCaptain = defineAction({
  accept: 'form',
  input: z.object({
    equipo_id: z.string().uuid(),
    capitan_cedula: z.string().min(9),
  }),
  handler: async (input, context) => {
    if (!context.locals.user) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Debe iniciar sesión',
      });
    }

    // Verify user owns this team
    const { data: team } = await actionSupabase
      .from('equipos')
      .select('delegado_id')
      .eq('id', input.equipo_id)
      .single();

    if (!team || team.delegado_id !== context.locals.user.id) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'No tiene permisos para modificar este equipo',
      });
    }

    // Verify player belongs to this team
    const { data: player } = await actionSupabase
      .from('equipo_deportistas')
      .select('deportista_cedula')
      .eq('deportista_cedula', input.capitan_cedula)
      .eq('equipo_id', input.equipo_id)
      .single();

    if (!player) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: 'El jugador no pertenece a este equipo',
      });
    }

    // Update team captain
    const { error } = await actionSupabase
      .from('equipos')
      .update({ capitan_id: input.capitan_cedula })
      .eq('id', input.equipo_id);

    if (error) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }

    return { success: true };
  },
});
