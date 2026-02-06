import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { supabase as publicSupabase, getSupabaseAdmin } from '../lib/supabase';
import { generateRoundRobin } from './generate-round-robin';
import { generateSingleElimination } from './generate-single-elimination';

const actionSupabase = getSupabaseAdmin();

// Helper to advance winner
const advanceWinner = async (matchId: string) => {
  const { data: match } = await actionSupabase
    .from('partidos')
    .select('id, torneo_id, siguiente_partido_id, equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante')
    .eq('id', matchId)
    .single();

  if (!match || !match.siguiente_partido_id) return;

  // Determine Winner
  let winnerId = null;
  if ((match.puntos_local ?? 0) > (match.puntos_visitante ?? 0)) {
      winnerId = match.equipo_local_id;
  } else if ((match.puntos_visitante ?? 0) > (match.puntos_local ?? 0)) {
      winnerId = match.equipo_visitante_id;
  }

  if (winnerId) {
      // Get Next Match to see which slot is empty or needs update
      const { data: nextMatch } = await actionSupabase
          .from('partidos')
          .select('id, equipo_local_id, equipo_visitante_id')
          .eq('id', match.siguiente_partido_id)
          .single();
      
      if (nextMatch) {
          const updateData: any = {};
          
          const participants = [match.equipo_local_id, match.equipo_visitante_id];

          // Heuristic: Check if any slot is occupied by a participant of THIS match.
          // If so, it means we pushed a winner before, so we update THAT slot.
          const localIsFromThisMatch = participants.includes(nextMatch.equipo_local_id);
          const visitorIsFromThisMatch = participants.includes(nextMatch.equipo_visitante_id);

          if (localIsFromThisMatch) {
              updateData.equipo_local_id = winnerId;
          } else if (visitorIsFromThisMatch) {
              updateData.equipo_visitante_id = winnerId;
          } else {
              // No slot occupied by us yet. Fill the first empty one.
              if (!nextMatch.equipo_local_id) {
                  updateData.equipo_local_id = winnerId;
              } else if (!nextMatch.equipo_visitante_id) {
                  updateData.equipo_visitante_id = winnerId;
              }
          }
          
          if (Object.keys(updateData).length > 0) {
              await actionSupabase
                  .from('partidos')
                  .update(updateData)
                  .eq('id', nextMatch.id);
          }
      }
  }
};

export const server = {
  signin: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
    handler: async ({ email, password }, context) => {
      const { data, error } = await publicSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: error.message,
        });
      }

      if (!data.user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      // Check if user is admin (optional, can also be done in middleware)
      // For now, we trust the login, middleware will check role.
      
      context.cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        secure: import.meta.env.PROD,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      
      context.cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        secure: import.meta.env.PROD,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      return { success: true };
    },
  }),
  signout: defineAction({
    accept: 'form',
    handler: async (_, context) => {
      context.cookies.delete('sb-access-token', { path: '/' });
      context.cookies.delete('sb-refresh-token', { path: '/' });
      await publicSupabase.auth.signOut();
      return { success: true };
    },
  }),
  createEvent: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string().optional(),
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
      location: z.string().min(1, "Location is required"),
      image: z.instanceof(File).optional(),
    }),
    handler: async (input) => {
      let imageUrl = null;

      try {
        // 1. Upload Image (only if provided and size > 0)
        if (input.image && input.image.size > 0) {
          const fileExt = input.image.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await actionSupabase.storage
            .from('event-images')
            .upload(filePath, input.image);

          if (uploadError) {
            console.error('Upload Error:', uploadError);
            throw new ActionError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Upload Failed: ${uploadError.message}`
            });
          }

          const { data: publicData } = actionSupabase.storage
            .from('event-images')
            .getPublicUrl(filePath);
            
          imageUrl = publicData.publicUrl;
        }

        // 2. Insert or Update Event
        const eventData: any = {
          title: input.title,
          description: input.description,
          date: input.date,
          location: input.location,
        };
        
        if (imageUrl) {
          eventData.image_url = imageUrl;
        }

        let data, error;

        if (input.id) {
          // Update
          ({ data, error } = await actionSupabase
            .from('events')
            .update(eventData)
            .eq('id', input.id)
            .select());
        } else {
          // Insert
          ({ data, error } = await actionSupabase
            .from('events')
            .insert([eventData])
            .select());
        }

        if (error) {
          console.error('Database Error:', error);
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Operation Failed: ${error.message}`
          });
        }

        return { success: true, event: data ? data[0] : null };
      } catch (err) {
        if (err instanceof ActionError) {
          throw err;
        }
        console.error('Unexpected Error:', err);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred processing your request.'
        });
      }
    },
  }),
  registerGuest: defineAction({
    accept: 'form',
    input: z.object({
      eventId: z.string(),
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Invalid email"),
    }),
    handler: async ({ eventId, name, email }) => {
      // 1. Check for duplicates
      const { count, error: countError } = await actionSupabase
        .from('registrations')
        .select('*', { count: 'exact' })
        .eq('event_id', eventId)
        .eq('email', email);

      if (countError) {
        console.warn('Duplicate Check Warning:', countError);
        // We will NOT throw here. If the check fails (e.g. permission), 
        // we'll try to proceed to Insert. 
        // The unique constraint or logic might still fail there, but it gives us a chance.
      }

      if (count && count > 0) {
        throw new ActionError({
          code: 'CONFLICT',
          message: 'This email is already registered for this event.'
        });
      }

      // 2. Register
      const { error } = await actionSupabase
        .from('registrations')
        .insert([{
          event_id: eventId,
          name,
          email,
          registration_date: new Date().toISOString()
        }]);

      if (error) {
        console.error('Registration Error:', error);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Registration failed: ${error.message}`
        });
      }

      return { success: true };
    },
  }),
  deleteRegistration: defineAction({
    accept: 'form',
    input: z.object({
      registrationId: z.string(),
    }),
    handler: async ({ registrationId }) => {
      const { error } = await actionSupabase
        .from('registrations')
        .delete()
        .eq('id', registrationId);

      if (error) {
        console.error('Delete Error:', error);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Deletion failed: ${error.message}`
        });
      }

      return { success: true };
    },
  }),
  deleteEvent: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string(),
    }),
    handler: async ({ id }) => {
      // First, delete associated registrations to avoid foreign key violation (23503)
      const { error: regError } = await actionSupabase
        .from('registrations')
        .delete()
        .eq('event_id', id);

      if (regError) {
        console.error('Delete Event Regs Error:', regError);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Could not delete event registrations: ${regError.message}`
        });
      }

      // Then delete the event
      const { error } = await actionSupabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete Event Error:', error);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Deletion failed: ${error.message}`
        });
      }

      return { success: true };
    },
  }),

  // Team & Player Actions (Restored)
  addPlayerToTeam: defineAction({
    accept: 'form',
    input: z.object({
      equipo_id: z.string(),
      numero_cedula: z.string().min(1, "Cédula requerida"),
      nombre: z.string().min(1, "Nombre requerido"),
      fecha_nacimiento: z.string().optional().nullable().or(z.literal('')),
      posicion: z.string().optional(),
      dorsal: z.coerce.number().optional().nullable(),
    }),
    handler: async (input) => {
      const fechaNacimiento = input.fecha_nacimiento === '' ? null : input.fecha_nacimiento;

      // Check duplicates
      const { data: existing } = await actionSupabase
        .from('deportistas')
        .select('*')
        .eq('numero_cedula', input.numero_cedula)
        .maybeSingle();

      if (existing) {
        throw new ActionError({ code: 'CONFLICT', message: 'Ya existe un jugador con esta cédula.' });
      }

      // Check dorsal
      if (input.dorsal) {
        const { data: dorsalExists } = await actionSupabase
            .from('deportistas')
            .select('id')
            .eq('equipo_id', input.equipo_id)
            .eq('dorsal', input.dorsal)
            .maybeSingle();
        if (dorsalExists) {
           throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso.` });
        }
      }

      
      try {
          const { error } = await actionSupabase.from('deportistas').insert([{
            equipo_id: input.equipo_id,
            numero_cedula: input.numero_cedula,
            nombre: input.nombre,
            fecha_nacimiento: fechaNacimiento,
            posicion: input.posicion || null,
            dorsal: input.dorsal || null, // nombre_deportivo removed
          }]);

          if (error) {
             if (error.code === '23505') { // Unique violation
                 throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso en este equipo.` });
             }
             throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          }
      } catch (err: any) {
          if (err instanceof ActionError) throw err;
           // If Supabase throws directly without returning { error } (rare in v2 but possible in wrappers)
           if (err?.code === '23505') {
               throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso en este equipo.` });
           }
           throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      }

      return { success: true };
    },
  }),

  updatePlayer: defineAction({
    accept: 'form',
    input: z.object({
      numero_cedula: z.string(),
      nombre: z.string().min(1, "Nombre requerido"),
      fecha_nacimiento: z.string().optional().nullable().or(z.literal('')),
      posicion: z.string().optional(),
      dorsal: z.coerce.number().optional().nullable(),
    }),
    handler: async (input) => {
        const fechaNacimiento = input.fecha_nacimiento === '' ? null : input.fecha_nacimiento;
        
        const { data: currentPlayer } = await actionSupabase
            .from('deportistas')
            .select('equipo_id')
            .eq('numero_cedula', input.numero_cedula)
            .single();

        if (!currentPlayer) throw new ActionError({ code: 'NOT_FOUND', message: 'Jugador no encontrado' });

        // Pre-check helps but race conditions exist, so we keep it + catch block.
         if (input.dorsal) {
            const { data: dorsalExists } = await actionSupabase
                .from('deportistas')
                .select('numero_cedula')
                .eq('equipo_id', currentPlayer.equipo_id)
                .eq('dorsal', input.dorsal)
                .neq('numero_cedula', input.numero_cedula)
                .maybeSingle();
            if (dorsalExists) throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso.` });
          }

        try {
            const { error } = await actionSupabase
              .from('deportistas')
              .update({
                 nombre: input.nombre,
                 fecha_nacimiento: fechaNacimiento,
                 posicion: input.posicion || null,
                 dorsal: input.dorsal || null,
              })
              .eq('numero_cedula', input.numero_cedula);

            if (error) {
                 if (error.code === '23505') {
                     throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso en este equipo.` });
                 }
                 throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            }
        } catch (err: any) {
             if (err instanceof ActionError) throw err;
             if (err?.code === '23505') {
                 throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso en este equipo.` });
             }
             throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
        }

        return { success: true };
    }
  }),

  deletePlayer: defineAction({
      accept: 'form',
      input: z.object({ 
        numero_cedula: z.string(),
        // Optional fallbacks/extras if needed, but strict is better
      }),
      handler: async ({ numero_cedula }) => {
          const { error } = await actionSupabase.from('deportistas').delete().eq('numero_cedula', numero_cedula);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  deletePlayers: defineAction({
      accept: 'form',
      input: z.object({
          cedulas: z.string() // JSON array string of cedulas
      }),
      handler: async ({ cedulas }) => {
          let cedulaList: string[] = [];
          try {
              cedulaList = JSON.parse(cedulas);
          } catch (e) {
              throw new ActionError({ code: 'BAD_REQUEST', message: 'Invalid format' });
          }

          if (cedulaList.length === 0) return { success: true };

          const { error } = await actionSupabase
              .from('deportistas')
              .delete()
              .in('numero_cedula', cedulaList);

          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  deleteTeam: defineAction({
      accept: 'form',
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
          // Cleanup Storage (Best Effort)
          const fileName = `team-${id}.webp`;
          // We don't check for error here, as file might not exist.
          await actionSupabase.storage.from('logos').remove([fileName]);

          await actionSupabase.from('deportistas').delete().eq('equipo_id', id);
          const { error } = await actionSupabase.from('equipos').delete().eq('id', id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
           return { success: true };
      }
  }),
  
    updateTeam: defineAction({ 
      accept: 'form',
      input: z.object({
          id: z.string(),
          nombre: z.string().min(1),
          logo_url: z.string().optional().nullable().or(z.literal('')),
          telefono_contacto: z.string().optional().nullable().or(z.literal('')),
          direccion_cancha: z.string().optional().nullable().or(z.literal('')),
      }),
      handler: async (input) => {
           const { error } = await actionSupabase
            .from('equipos')
            .update({
                nombre: input.nombre,
                logo_url: input.logo_url || null,
                telefono_contacto: input.telefono_contacto || null,
                direccion_cancha: input.direccion_cancha || null
            })
            .eq('id', input.id);
            
            if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            return { success: true };
      }
  }),

  setCaptain: defineAction({
    accept: 'form',
    input: z.object({
      equipo_id: z.string(),
      numero_cedula: z.string(),
    }),
    handler: async ({ equipo_id, numero_cedula }) => {
      // 1. Verify player belongs to team
      const { data: player } = await actionSupabase
        .from('deportistas')
        .select('numero_cedula, equipo_id')
        .eq('numero_cedula', numero_cedula)
        .single();
      
      if (!player || player.equipo_id !== equipo_id) {
         throw new ActionError({ code: 'BAD_REQUEST', message: 'El jugador no pertenece a este equipo.' });
      }

      // 2. Set captain
      const { error } = await actionSupabase
        .from('equipos')
        .update({ capitan_id: numero_cedula })
        .eq('id', equipo_id);
      
      if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }
  }),

  removeCaptain: defineAction({
      accept: 'form',
      input: z.object({ equipo_id: z.string() }),
      handler: async ({ equipo_id }) => {
          const { error } = await actionSupabase.from('equipos').update({ capitan_id: null }).eq('id', equipo_id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  // Tournament Management Actions (Restored)
  createTournament: defineAction({
    accept: 'form',
    input: z.object({
      nombre: z.string().min(1, "El nombre es requerido"),
      deporte_id: z.string().uuid("Deporte requerido"),
      tipo: z.enum(['liga', 'eliminacion_simple', 'grupos_eliminacion']).default('liga'),
      fecha_inicio: z.string().optional(),
      fecha_fin: z.string().optional(),
      estado: z.enum(['pendiente', 'activo', 'finalizado', 'cancelado']).default('pendiente'),
    }),
    handler: async (input) => {
        const { data, error } = await actionSupabase
            .from('torneos')
            .insert([{
                nombre: input.nombre,
                deporte_id: input.deporte_id,
                tipo: input.tipo,
                fecha_inicio: input.fecha_inicio || null,
                fecha_fin: input.fecha_fin || null,
                estado: input.estado
            }])
            .select()
            .single();

        if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return { success: true, torneo: data };
    }
  }),

  deleteTournament: defineAction({
      accept: 'form',
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
          // Cleanup Storage (Best Effort)
          const fileName = `tournament-${id}.webp`;
          await actionSupabase.storage.from('logos').remove([fileName]);

          // Delete cascade handled by DB usually, but manual cleanup for safety
          const { error } = await actionSupabase.from('torneos').delete().eq('id', id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  // Add existing team to tournament
  registerTeamInTournament: defineAction({
      accept: 'form',
      input: z.object({
          torneo_id: z.string(),
          equipo_id: z.string()
      }),
      handler: async ({ torneo_id, equipo_id }) => {
          // Check if already registered
          const { data: existing } = await actionSupabase
            .from('torneo_participantes')
            .select('*')
            .eq('torneo_id', torneo_id)
            .eq('equipo_id', equipo_id)
            .maybeSingle();
            
          if (existing) {
              throw new ActionError({ code: 'CONFLICT', message: 'Este equipo ya está inscrito en el torneo.' });
          }

          const { error } = await actionSupabase
            .from('torneo_participantes')
            .insert([{ torneo_id, equipo_id }]);

          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  // Matchday & Match Management Actions (Restored)
  createJornada: defineAction({
      accept: 'form',
      input: z.object({
          torneo_id: z.string(),
          nombre: z.string().optional(),
          fecha_inicio: z.string().optional(),
          fecha_fin: z.string().optional(),
      }),
      handler: async (input) => {
          // Get next numero
          const { count } = await actionSupabase
            .from('jornadas')
            .select('*', { count: 'exact', head: true })
            .eq('torneo_id', input.torneo_id);
          
          const numero_jornada = (count || 0) + 1;

          const { data, error } = await actionSupabase
            .from('jornadas')
            .insert([{
                torneo_id: input.torneo_id,
                nombre_fase: input.nombre || null, // Map 'nombre' input to 'nombre_fase' column, handle empty/undefined as null
                numero_jornada,            // Map calculated number to 'numero_jornada' column
                fecha_inicio: input.fecha_inicio || null,
                fecha_fin: input.fecha_fin || null,
                estado: 'pendiente'        // Use valid enum value 'pendiente'
            }])
            .select()
            .single();

          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true, jornada: data };
      }
  }),

  updateJornada: defineAction({
      accept: 'form',
      input: z.object({
          id: z.string(),
          nombre: z.string().optional(), // Maps to nombre_fase
          numero_jornada: z.number({ coerce: true }),
          fecha_inicio: z.string().optional(),
          fecha_fin: z.string().optional(),
      }),
      handler: async (input) => {
          const { data, error } = await actionSupabase
            .from('jornadas')
            .update({
                nombre_fase: input.nombre || null,
                numero_jornada: input.numero_jornada,
                fecha_inicio: input.fecha_inicio || null,
                fecha_fin: input.fecha_fin || null,
            })
            .eq('id', input.id)
            .select()
            .single();

          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true, jornada: data };
      }
  }),

  deleteJornada: defineAction({
      accept: 'form',
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
          const { error } = await actionSupabase.from('jornadas').delete().eq('id', id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  createMatch: defineAction({
      accept: 'form',
      input: z.object({
          jornada_id: z.string(),
          equipo_local_id: z.string(),
          equipo_visitante_id: z.string(),
          fecha_partido: z.string().optional()
      }),
      handler: async (input) => {
          if (input.equipo_local_id === input.equipo_visitante_id) {
              throw new ActionError({ code: 'BAD_REQUEST', message: 'El equipo local y visitante no pueden ser el mismo.' });
          }

          // Fetch jornada to get torneo_id (needed for RLS or strict schema sometimes, or just context)
          const { data: jornada } = await actionSupabase.from('jornadas').select('torneo_id').eq('id', input.jornada_id).single();
          if (!jornada) throw new ActionError({ code: 'NOT_FOUND', message: 'Jornada no encontrada' });

          // Check for duplicate matches (A vs B or B vs A)
          const { data: duplicates } = await actionSupabase
            .from('partidos')
            .select('id')
            .eq('jornada_id', input.jornada_id)
            .or(`and(equipo_local_id.eq.${input.equipo_local_id},equipo_visitante_id.eq.${input.equipo_visitante_id}),and(equipo_local_id.eq.${input.equipo_visitante_id},equipo_visitante_id.eq.${input.equipo_local_id})`);
          
          if (duplicates && duplicates.length > 0) {
            throw new ActionError({ 
              code: 'BAD_REQUEST', 
              message: 'Ya existe un partido entre estos equipos en esta jornada' 
            });
          }

          const { error } = await actionSupabase
            .from('partidos')
            .insert([{
                jornada_id: input.jornada_id,
                equipo_local_id: input.equipo_local_id,
                equipo_visitante_id: input.equipo_visitante_id,
                torneo_id: jornada.torneo_id,
                fecha_partido: input.fecha_partido || null,
                estado_partido: 'pendiente'
            }]);

          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),

  deleteMatch: defineAction({
      accept: 'form',
      input: z.object({ id: z.string() }),
      handler: async ({ id }) => {
          const { error } = await actionSupabase.from('partidos').delete().eq('id', id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          return { success: true };
      }
  }),
  


  // Automatic Fixture Generator (Simple Round Robin)
  generateFixture: defineAction({
      accept: 'form',
      input: z.object({ torneo_id: z.string() }),
      handler: async ({ torneo_id }) => {
          // 1. Fetch registered teams
          const { data: participants } = await actionSupabase
            .from('torneo_participantes')
            .select('equipo_id')
            .eq('torneo_id', torneo_id);
          
          if (!participants || participants.length < 2) {
              throw new ActionError({ code: 'BAD_REQUEST', message: 'Se necesitan al menos 2 equipos para generar el fixture.' });
          }

          const teamIds = participants.map(p => p.equipo_id);
          
          // Add "Bye" team if odd number
          if (teamIds.length % 2 !== 0) {
              teamIds.push(null); // Ghost team
          }

          const numTeams = teamIds.length;
          const numRounds = numTeams - 1;
          const matchesPerRound = numTeams / 2;

          let rounds: { roundNum: number, matches: { home: string | null, away: string | null }[] }[] = [];

          for (let round = 0; round < numRounds; round++) {
              let roundMatches = [];
              for (let match = 0; match < matchesPerRound; match++) {
                  const home = teamIds[match];
                  const away = teamIds[numTeams - 1 - match];
                  if (home !== null && away !== null) {
                       roundMatches.push({ home, away });
                  }
              }
              rounds.push({ roundNum: round + 1, matches: roundMatches });
              
              // Rotate teams (keep first fixed)
              const first = teamIds[0];
              const rest = teamIds.slice(1);
              const last = rest.pop();
              if (last && rest) {
                rest.unshift(last);
              }
              teamIds.splice(0, teamIds.length, first, ...rest);
          }

          // 2. Insert into DB transaction-like
          // Note: Supabase doesn't support complex transactions via JS client easily yet without RPC.
          // We will do simple sequential inserts.
          
          for (const round of rounds) {
              // Create Jornada
              const { data: jornada, error: jError } = await actionSupabase
                .from('jornadas')
                .insert([{
                    torneo_id,
                    nombre_fase: `Jornada ${round.roundNum}`,
                    numero_jornada: round.roundNum,
                    estado: 'pendiente'
                }])
                .select()
                .single();
              
              if (jError || !jornada) continue; // Skip or error handling

              // Create Matches for this Jornada
              const matchesToInsert = round.matches.map(m => ({
                  torneo_id,
                  jornada_id: jornada.id,
                  equipo_local_id: m.home,
                  equipo_visitante_id: m.away,
                  estado: 'pendiente'
              }));

              await actionSupabase.from('partidos').insert(matchesToInsert);
          }

          return { success: true, message: 'Fixture generado correctamente' };
      }
  }),

  // Excel Import for Players (with smart duplicate handling)
  importPlayersFromExcel: defineAction({
    accept: 'form',
    input: z.object({
      excelFile: z.string(), // Base64 encoded Excel file
      equipo_id: z.string().uuid(),
    }),
    handler: async ({ excelFile, equipo_id }, context) => {
      if (!context.locals.user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Debe iniciar sesión para realizar esta acción.',
        });
      }

      // Dynamic import of excel-helpers to avoid issues with server-side rendering
      const { parseExcelToPlayers } = await import('../lib/excel-helpers');

      // Convert base64 to ArrayBuffer
      const base64Data = excelFile.split(',')[1] || excelFile;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = bytes.buffer;

      // Parse Excel file
      const parseResult = parseExcelToPlayers(buffer);

      // Validation errors from parsing (format issues)
      const validationErrors = parseResult.errors;

      // Check for existing players (by cedula) in database
      const cedulas = parseResult.players.map(p => p.cedula);
      const { data: existingPlayers } = await actionSupabase
        .from('deportistas')
        .select('numero_cedula')
        .in('numero_cedula', cedulas);

      const existingCedulas = new Set(existingPlayers?.map(p => p.numero_cedula) || []);

      // Check for duplicate dorsals in this team
      const dorsalsToCheck = parseResult.players
        .filter(p => p.dorsal !== undefined)
        .map(p => p.dorsal!);

      let existingDorsals = new Set<number>();
      if (dorsalsToCheck.length > 0) {
        const { data: existingDorsalPlayers } = await actionSupabase
          .from('deportistas')
          .select('dorsal')
          .eq('equipo_id', equipo_id)
          .in('dorsal', dorsalsToCheck);

        existingDorsals = new Set(existingDorsalPlayers?.map(p => p.dorsal).filter(d => d !== null) as number[] || []);
      }

      // Separate players into categories
      const playersToInsert = [];
      const skippedDuplicates = []; // Players that already exist (not errors)
      const dorsalErrors = []; // Dorsal conflicts

      for (const player of parseResult.players) {
        if (existingCedulas.has(player.cedula)) {
          // Skip silently - already exists
          skippedDuplicates.push({
            cedula: player.cedula,
            nombre: player.nombre,
          });
        } else if (player.dorsal && existingDorsals.has(player.dorsal)) {
          // Dorsal conflict is a real error
          dorsalErrors.push({
            row: 0,
            message: `Jugador "${player.nombre}" (${player.cedula}): Dorsal ${player.dorsal} ya está asignado en este equipo`,
          });
        } else {
          playersToInsert.push({
            numero_cedula: player.cedula,
            nombre: player.nombre,
            fecha_nacimiento: player.fecha_nacimiento || null,
            posicion: player.posicion || null,
            dorsal: player.dorsal || null,
            equipo_id,
          });
        }
      }

      // Insert valid new players
      let insertedCount = 0;
      if (playersToInsert.length > 0) {
        const { error: insertError } = await actionSupabase
          .from('deportistas')
          .insert(playersToInsert);

        if (insertError) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Error al insertar jugadores: ${insertError.message}`,
          });
        }

        insertedCount = playersToInsert.length;
      }

      // Combine all real errors (validation + dorsal conflicts)
      const allErrors = [...validationErrors, ...dorsalErrors];

      return {
        success: true,
        imported: insertedCount,
        skipped: skippedDuplicates.length,
        errors: allErrors,
        totalRows: parseResult.totalRows,
      };
    },
  }),

  // Smart Image Upload Action
  uploadSmartImage: defineAction({
    accept: 'form',
    input: z.object({
      file: z.instanceof(File),
      bucket: z.string(),
      entityId: z.string(), // ID to update in DB
      entityType: z.enum(['team', 'tournament']),
    }),
    handler: async ({ file, bucket, entityId, entityType }) => {
      // 0. Ensure Bucket Exists (Auto-Setup)
      try {
          const { data: buckets } = await actionSupabase.storage.listBuckets();
          // Case insensitive check
          const existingBucket = buckets?.find(b => b.name.toLowerCase() === bucket.toLowerCase());
          
          if (!existingBucket) {
              console.log(`[SmartUpload] Bucket '${bucket}' not found. Creating...`);
              const { error: createError } = await actionSupabase.storage.createBucket(bucket, {
                  public: true,
                  fileSizeLimit: 5242880, // 5MB limit
                  allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg']
              });
              
              if (createError && !createError.message.includes('already exists')) {
                  console.error('[SmartUpload] Create Bucket Error:', createError);
              }
          }
      } catch (bucketErr) {
          console.error('[SmartUpload] Bucket Check Failed:', bucketErr);
      }

      // 1. Upload to Supabase Storage
      // Use deterministic filename to OVERWRITE existing image (avoids garbage)
      const fileExt = "webp"; 
      const fileName = `${entityType}-${entityId}.${fileExt}`; // Fixed name per entity
      const filePath = `${fileName}`;

      console.log(`[SmartUpload] Uploading (Upsert) to ${bucket}/${filePath}...`);

      const { error: uploadError } = await actionSupabase.storage
        .from(bucket)
        .upload(filePath, file, {
            upsert: true, // Overwrite if exists
            contentType: 'image/webp',
            cacheControl: '3600'
        });

      if (uploadError) {
        console.error('[SmartUpload] Upload Error Detailed:', JSON.stringify(uploadError));
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Storage Upload Failed: ${uploadError.message}`
        });
      }

      // 2. Get Public URL
      const { data: { publicUrl } } = actionSupabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      // Force a cache-busting query param on the returned URL if possible, or client handles it
      // Storage Public URL is static, so client side cache busting is best.

      // 3. Update Database Record
      const table = entityType === 'team' ? 'equipos' : 'torneos';
      const column = 'logo_url'; 

      const { error: dbError } = await actionSupabase
        .from(table)
        .update({ [column]: publicUrl })
        .eq('id', entityId);

      if (dbError) {
         throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Database Update Failed: ${dbError.message}`
        });
      }

      return { success: true, url: publicUrl };
    },
  }),

  deleteSmartImage: defineAction({
    accept: 'form',
    input: z.object({
        bucket: z.string(),
        entityId: z.string(),
        entityType: z.enum(['team', 'tournament']),
    }),
    handler: async ({ bucket, entityId, entityType }) => {
        // 1. Determine filename
        const fileName = `${entityType}-${entityId}.webp`;
        
        // 2. Remove from Storage
        const { error: storageError } = await actionSupabase.storage
            .from(bucket)
            .remove([fileName]);
            
        if (storageError) {
             console.error('Delete Storage Error:', storageError);
             // Verify if file really existed? Proceed to clear DB anyway.
        }

        // 3. Clear DB field
        const table = entityType === 'team' ? 'equipos' : 'torneos';
        const column = 'logo_url';

        const { error: dbError } = await actionSupabase
            .from(table)
            .update({ [column]: null })
            .eq('id', entityId);

        if (dbError) {
            throw new ActionError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Database Clear Failed: ${dbError.message}`
            });
        }

        return { success: true };
    }
  }),

  // ========== MATCH EVENTS SYSTEM ==========
  
  addMatchEvent: defineAction({
    accept: 'form',
    input: z.object({
      partido_id: z.string(),
      tipo_evento: z.enum(['gol', 'tarjeta_amarilla', 'tarjeta_roja', 'sustitucion']),
      minuto: z.number().min(0).max(120),
      jugador_cedula: z.string(),
      equipo_id: z.string(),
      detalles: z.record(z.any()).optional()
    }),
    handler: async (input) => {
      // Validate player belongs to team
      const { data: player } = await actionSupabase
        .from('deportistas')
        .select('equipo_id')
        .eq('numero_cedula', input.jugador_cedula)
        .single();
      
      if (!player || player.equipo_id !== input.equipo_id) {
        throw new ActionError({ 
          code: 'BAD_REQUEST', 
          message: 'El jugador no pertenece al equipo seleccionado' 
        });
      }

      // Validate team participates in match
      const { data: match } = await actionSupabase
        .from('partidos')
        .select('equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante')
        .eq('id', input.partido_id)
        .single();
      
      if (!match || (match.equipo_local_id !== input.equipo_id && match.equipo_visitante_id !== input.equipo_id)) {
        throw new ActionError({ 
          code: 'BAD_REQUEST', 
          message: 'El equipo no participa en este partido' 
        });
      }

      // Insert event
      const { error: insertError } = await actionSupabase
        .from('eventos_partido')
        .insert({
          partido_id: input.partido_id,
          tipo_evento: input.tipo_evento,
          minuto: input.minuto,
          jugador_cedula: input.jugador_cedula,
          equipo_id: input.equipo_id,
          detalles: input.detalles || {}
        });
      
      if (insertError) {
        throw new ActionError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: insertError.message 
        });
      }

      // Auto-update score if goal
      if (input.tipo_evento === 'gol') {
        const isLocal = match.equipo_local_id === input.equipo_id;
        const updateData: any = isLocal 
          ? { puntos_local: (match.puntos_local || 0) + 1 }
          : { puntos_visitante: (match.puntos_visitante || 0) + 1 };
        
        // If match is pending, set to in_progress
        // We fetching only points, let's assume if we are adding a goal it should be in progress
        // Ideally we check current status, but for now we can just safe set it if we want trigger live
        // But better query status. The `match` const above selected only specific fields.
        // Let's rely on update.
        // We will just force 'en_curso' if it's not finalizado?
        // Let's add estado_partido to select above to be sure.
        
        // Oh wait, select above was: .select('equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante')
        // I need to update that first. 
        // For this chunk, I will just proceed assuming I can add it to updateData.
        
        updateData.estado_partido = 'en_curso';

        await actionSupabase
          .from('partidos')
          .update(updateData)
          .eq('id', input.partido_id)
          .neq('estado_partido', 'finalizado'); // Don't re-open finalized matches automatically (optional rule)
      } else {
        // Even for non-goals, set to en_curso? User request was about standings (goals).
        // Let's stick to goals for now to avoid side effects on just cards before whistle.
        // Actually, if a card happens, match started.
         await actionSupabase
          .from('partidos')
          .update({ estado_partido: 'en_curso' })
          .eq('id', input.partido_id)
          .eq('estado_partido', 'pendiente');
      }

      return { success: true };
    }
  }),

  batchSaveMatchEvents: defineAction({
    accept: 'form',
    input: z.object({
      partido_id: z.string(),
      events: z.string(), // JSON array of events
      finalizar: z.boolean().optional(),
    }),
    handler: async (input) => {
      let eventsList: any[] = [];
      try {
        eventsList = JSON.parse(input.events);
      } catch (e) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Invalid events format' });
      }

      // Check if we have events OR if we just want to finalize
      if (eventsList.length === 0 && !input.finalizar) return { success: true };

      // Validate match exists
      const { data: match } = await actionSupabase
        .from('partidos')
        .select('equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante')
        .eq('id', input.partido_id)
        .single();

      if (!match) throw new ActionError({ code: 'NOT_FOUND', message: 'Match not found' });

      // Prepare events for insertion
      if (eventsList.length > 0) {
          const eventsToInsert = eventsList.map(e => ({
            partido_id: input.partido_id,
            tipo_evento: e.tipo_evento,
            minuto: e.minuto,
            jugador_cedula: e.jugador_cedula,
            equipo_id: e.equipo_id,
            detalles: e.detalles || {}
          }));

          // Insert events
          const { error: insertError } = await actionSupabase
            .from('eventos_partido')
            .insert(eventsToInsert);

          if (insertError) {
            throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: insertError.message });
          }
      }

      // Calculate score updates
      let additionalLocal = 0;
      let additionalVisitor = 0;

      eventsList.forEach(e => {
        if (e.tipo_evento === 'gol') {
          if (e.equipo_id === match.equipo_local_id) additionalLocal++;
          else if (e.equipo_id === match.equipo_visitante_id) additionalVisitor++;
        }
      });

      // Update match
      const nuevoEstado = input.finalizar ? 'finalizado' : 'en_curso';
      const updateData: any = { estado_partido: nuevoEstado };
      
      if (additionalLocal > 0 || additionalVisitor > 0) {
           updateData.puntos_local = (match.puntos_local || 0) + additionalLocal;
           updateData.puntos_visitante = (match.puntos_visitante || 0) + additionalVisitor;
      }
      
      // Update if scores changed OR state changed (e.g. finalizing)
      if (Object.keys(updateData).length > 0) {
           await actionSupabase
          .from('partidos')
          .update(updateData)
          .eq('id', input.partido_id);
      }

      if (input.finalizar) {
          await advanceWinner(input.partido_id);
      }

      return { success: true };
    }
  }),

 // ... other actions ...

  updateMatchResult: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string(),
      puntos_local: z.number().min(0),
      puntos_visitante: z.number().min(0),
      finalizar: z.boolean().optional(),
    }),
    handler: async (input) => {
      // 1. Get Match Info & Tournament Type
      const { data: match } = await actionSupabase
        .from('partidos')
        .select(`
          id, 
          torneo_id, 
          siguiente_partido_id, 
          jornada_id,
          torneo:torneos(tipo),
          equipo_local_id,
          equipo_visitante_id
        `)
        .eq('id', input.id)
        .single();
      
      if (!match) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'Match not found' });
      }

      const nuevoEstado = input.finalizar ? 'finalizado' : 'en_curso';

      // 2. Update Match
      const { error: updateError } = await actionSupabase
        .from('partidos')
        .update({
          puntos_local: input.puntos_local,
          puntos_visitante: input.puntos_visitante,
          estado_partido: nuevoEstado
        })
        .eq('id', input.id);

      if (updateError) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message });
      }

      // 3. Elimination Advancement Logic
      if (input.finalizar && match.siguiente_partido_id) {
          await advanceWinner(match.id);
      }

      return { success: true };
    }
  }),
  generateRoundRobin,
  generateSingleElimination,
};
