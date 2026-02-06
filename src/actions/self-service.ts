import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { getSupabaseAdmin } from '../lib/supabase';

const actionSupabase = getSupabaseAdmin();

/**
 * Self-Service Registration Actions
 * Export these and merge with main server object in index.ts
 */

export const selfServiceRegistrationActions = {
  // Create team as delegado
  createTeamAsDelegado: defineAction({
    accept: 'form',
    input: z.object({
      nombre: z.string().min(1, "Nombre requerido"),
      telefono_contacto: z.string().optional(),
      direccion_cancha: z.string().min(1, "Dirección requerida"),
      logo_url: z.string().optional(),
    }),
    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Debe iniciar sesión',
        });
      }

      const { data: team, error } = await (actionSupabase
        .from('equipos') as any)
        .insert([{
          nombre: input.nombre,
          delegado_id: context.locals.user.id,
          telefono_contacto: input.telefono_contacto,
          direccion_cancha: input.direccion_cancha,
          logo_url: input.logo_url,
          bloqueado_edicion: false,
        }])
        .select()
        .single();

      if (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true, team };
    },
  }),

  // Add player with cedula
  addPlayerToTeam: defineAction({
    accept: 'form',
    input: z.object({
      numero_cedula: z.string().min(9, "Cédula debe tener al menos 9 dígitos"),
      nombre: z.string().min(1, "Nombre requerido"),
      fecha_nacimiento: z.string().nullish(),
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

      // Verify ownership or Admin role
      // 1. Check if Team belongs to user
      const { data: team } = await actionSupabase
        .from('equipos')
        .select('delegado_id, bloqueado_edicion')
        .eq('id', input.equipo_id)
        .single();
        
      if (!team) throw new ActionError({ code: 'NOT_FOUND', message: 'Equipo no encontrado' });

      // 2. Determine if user is allowed
      let isAllowed = team.delegado_id === context.locals.user.id;
      
      if (!isAllowed) {
         const { data: profile } = await actionSupabase
             .from('profiles')
             .select('role')
             .eq('id', context.locals.user.id)
             .single();
         if (profile?.role === 'admin') isAllowed = true;
      }

      if (!isAllowed) {
         throw new ActionError({
            code: 'FORBIDDEN',
            message: 'No tienes permiso para agregar jugadores a este equipo'
         });
      }

      // 3. If NOT admin, check "bloqueado_edicion"
      // If Admin, they can override lock? Usually yes, or maybe not. 
      // Let's assume Admin handles locks separately, but for data integrity if locked, maybe forbid even Admin unless they unlock first.
      // But typical use case: Admin edits locked team. So let's skip lock check for Admin.
      
      // Re-check profile role if checking lock override
      const isAdmin = isAllowed && team.delegado_id !== context.locals.user.id; // approximate check
      
      // Actually strictly check role again or reuse logic
      if (team.bloqueado_edicion && !isAdmin) {
          // Double check admin role if we denied based on lock
          // (In optimized code we would fetch role once at start)
         const { data: profile } = await actionSupabase.from('profiles').select('role').eq('id', context.locals.user.id).single();
         if (profile?.role !== 'admin') {
             throw new ActionError({
                code: 'FORBIDDEN',
                message: 'El equipo está bloqueado y no se pueden agregar jugadores',
              });
         }
      }

      // Clean cedula
      const cleanedCedula = input.numero_cedula.replace(/[^0-9]/g, '');

      const { data: player, error } = await (actionSupabase
        .from('deportistas') as any)
        .insert([{
          numero_cedula: cleanedCedula,
          nombre: input.nombre,
          fecha_nacimiento: input.fecha_nacimiento || null,
          posicion: input.posicion,
          dorsal: input.dorsal,
          equipo_id: input.equipo_id,
        }])
        .select()
        .single();

      if (error) {
        // Check for specific constraint violations
        if (error.code === '23505') {
          if (error.message.includes('unique_numero_cedula') || error.message.includes('numero_cedula')) {
            throw new ActionError({
              code: 'CONFLICT',
              message: `La cédula ${cleanedCedula} ya está registrada en el sistema`,
            });
          }
          if (error.message.includes('unique_dorsal_per_team') || error.message.includes('dorsal')) {
            throw new ActionError({
              code: 'CONFLICT',
              message: `El dorsal ${input.dorsal} ya está en uso en este equipo`,
            });
          }
          // Generic duplicate error
          throw new ActionError({
            code: 'CONFLICT',
            message: 'Este jugador ya está registrado',
          });
        }
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true, player };
    },
  }),

  // Submit for review
  submitTeamForReview: defineAction({
    accept: 'form',
    input: z.object({
      equipo_id: z.string().uuid(),
      torneo_id: z.string().uuid(),
    }),
    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Debe iniciar sesión',
        });
      }

      const { error } = await (actionSupabase
        .from('torneo_participantes') as any)
        .update({ status: 'en_revision' })
        .eq('equipo_id', input.equipo_id)
        .eq('torneo_id', input.torneo_id);

      if (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    },
  }),

  // Approve team
  approveTeam: defineAction({
    accept: 'form',
    input: z.object({
      participante_id: z.string().uuid(),
    }),
    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Debe iniciar sesión',
        });
      }

      const { data: participante } = await actionSupabase
        .from('torneo_participantes')
        .select('equipo_id')
        .eq('id', input.participante_id)
        .single();

      if (!participante) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: 'Participación no encontrada',
        });
      }

      const { error } = await (actionSupabase
        .from('torneo_participantes') as any)
        .update({
          status: 'aprobado',
          fecha_aprobacion: new Date().toISOString(),
          aprobado_por: context.locals.user.id,
        })
        .eq('id', input.participante_id);

      if (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      // Lock team
      await (actionSupabase.from('equipos') as any)
        .update({ bloqueado_edicion: true })
        .eq('id', participante.equipo_id);

      return { success: true };
    },
  }),

  // Reject team
  rejectTeam: defineAction({
    accept: 'form',
    input: z.object({
      participante_id: z.string().uuid(),
      notas_rechazo: z.string().min(1, "Debe proporcionar una razón"),
    }),
    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Debe iniciar sesión',
        });
      }

      const { error } = await (actionSupabase
        .from('torneo_participantes') as any)
        .update({
          status: 'rechazado',
          notas_rechazo: input.notas_rechazo,
        })
        .eq('id', input.participante_id);

      if (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    },
  }),
};
