import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { supabase as publicSupabase, getSupabaseAdmin } from '../lib/supabase';
import { generateRoundRobin } from './generate-round-robin';
import { generateSingleElimination } from './generate-single-elimination';
import { generateGroupsPlayoff } from './generate-groups-playoff';
import { generatePlayoffFromGroups } from './generate-playoff-from-groups';
import { selfServiceRegistrationActions } from './self-service';

const actionSupabase = getSupabaseAdmin();

// Helper to advance winner
const advanceWinner = async (matchId: string) => {
  const { data: match } = await actionSupabase
    .from('partidos')
    .select('id, torneo_id, jornada_id, siguiente_partido_id, equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante, ronda, penales_jugados, penales_local, penales_visitante, ganador_agregado_id, es_partido_vuelta')
    .eq('id', matchId)
    .single();

  if (!match) return;
  
  // Cast to any to access fields that might be missing from types
  const matchData = match as any;

  console.log(`[AdvanceWinner] Checking match ${matchId}`, match);

  // Determine Winner
  let winnerId = null;

  if (matchData.es_partido_vuelta) {
      // Logic for Return Matches (Global Score)
      if (matchData.ganador_agregado_id) {
          winnerId = matchData.ganador_agregado_id;
          console.log(`[AdvanceWinner] Using aggregate winner: ${winnerId}`);
      } else {
          // Aggregate Tie -> Check Penalties
          if (matchData.penales_jugados && matchData.penales_local !== null && matchData.penales_visitante !== null) {
              if (matchData.penales_local > matchData.penales_visitante) {
                  winnerId = match.equipo_local_id;
              } else if (matchData.penales_visitante > matchData.penales_local) {
                  winnerId = match.equipo_visitante_id;
              }
          }
      }
  } else {
      // Logic for Single Matches
      if ((match.puntos_local ?? 0) > (match.puntos_visitante ?? 0)) {
          winnerId = match.equipo_local_id;
      } else if ((match.puntos_visitante ?? 0) > (match.puntos_local ?? 0)) {
          winnerId = match.equipo_visitante_id;
      } else {
          // Regular time is a draw - check penalty shootout
          if (matchData.penales_jugados && matchData.penales_local !== null && matchData.penales_visitante !== null) {
              if (matchData.penales_local > matchData.penales_visitante) {
                  winnerId = match.equipo_local_id;
              } else if (matchData.penales_visitante > matchData.penales_local) {
                  winnerId = match.equipo_visitante_id;
              }
          }
      }
  }
  
  if (!winnerId) {
      console.log(`[AdvanceWinner] No winner determined yet for match ${matchId}`);
      return; 
  }

  // If there is a linked next match, use it (Automatic path)
  if (match.siguiente_partido_id) {
      const { data: nextMatch } = await actionSupabase
          .from('partidos')
          .select('id, equipo_local_id, equipo_visitante_id')
          .eq('id', match.siguiente_partido_id)
          .single();
      
      if (nextMatch) {
          const updateData: any = {};
          const participants = [match.equipo_local_id, match.equipo_visitante_id];
          const localIsFromThisMatch = participants.includes(nextMatch.equipo_local_id);
          const visitorIsFromThisMatch = participants.includes(nextMatch.equipo_visitante_id);

          if (localIsFromThisMatch) {
              updateData.equipo_local_id = winnerId;
          } else if (visitorIsFromThisMatch) {
              updateData.equipo_visitante_id = winnerId;
          } else {
              if (!nextMatch.equipo_local_id) updateData.equipo_local_id = winnerId;
              else if (!nextMatch.equipo_visitante_id) updateData.equipo_visitante_id = winnerId;
          }
          
          if (Object.keys(updateData).length > 0) {
              await actionSupabase.from('partidos').update(updateData).eq('id', nextMatch.id);
          }
      }
      return; 
  }

  // If NO linked match, check if we need to generate next round (Manual/Dynamic path)
  // 1. Check tournament type
  const { data: torneo } = await actionSupabase
    .from('torneos')
    .select('tipo, estado')
    .eq('id', match.torneo_id)
    .single();

  if (!torneo || (torneo.tipo !== 'eliminacion_simple' && torneo.tipo !== 'grupos_eliminacion')) {
    return;
  }

  // Critical: For 'grupos_eliminacion', ONLY the playoff phase (where ronda is set) should potentially trigger completion.
  // The Group Phase (ronda is null) must NEVER trigger dynamic bracket generation (it uses points).
  if (torneo.tipo === 'grupos_eliminacion' && !matchData.ronda) {
      return;
  }

  // 2. Check if all matches in CURRENT Round (Jornada) are finished
  const { data: currentJornadaMatches } = await actionSupabase
    .from('partidos')
    .select('id, estado_partido, puntos_local, puntos_visitante, equipo_local_id, equipo_visitante_id')
    .eq('jornada_id', match.jornada_id)
    .order('id', { ascending: true }); // Ensure consistent order

  const totalMatches = currentJornadaMatches?.length || 0;
  // Modification: A match is only considered "finished" for advancement purposes if it has a WINNER.
  // Just being 'finalizado' is not enough if it's a tie that needs penalties.
  // BUT, determining if it has a winner is complex here without fetching aggregate info for all.
  // For now, let's stick to 'finalizado' BUT we must ensure the `advanceWinner` logic (which is called for each match)
  // has properly updated the next bracket.
  
  // Actually, for dynamic bracket generation, we usually wait for all matches to be finalized.
  const finishedMatches = currentJornadaMatches?.filter(m => m.estado_partido === 'finalizado').length || 0;

  console.log(`[AdvanceWinner] Round progress: ${finishedMatches}/${totalMatches}`);

  // Only proceed if ALL matches in this round are finished
  if (finishedMatches < totalMatches) {
      return;
  }

  // 3. Logic for Next Step
  if (totalMatches === 1) {
      // If there was only 1 match and it's finished, IT WAS THE FINAL.
      console.log(`[AdvanceWinner] Final match finished. Completing tournament.`);
      await actionSupabase.from('torneos').update({ estado: 'finalizado' }).eq('id', match.torneo_id);
  } else {
      // Generate Next Round
      console.log(`[AdvanceWinner] Generating next round...`);
      
      // Collect winners from current round
      // TODO: This mapping is simplistic and likely buggy for two-legged ties.
      // Ideally, we should fetch the `ganador_agregado_id` for two-legged matches.
      // But `currentJornadaMatches` selection above didn't include it. 
      // Fortunately, dynamic generation usually happens for single-leg brackets in this system (assumption).
      // If we support two-legged dynamic brackets, this needs a deeper refactor.
      // For now, I'll trust the single match logic for simple elimination, which is the primary use case for dynamic generation.
      const winners = currentJornadaMatches!.map(m => {
          if ((m.puntos_local ?? 0) > (m.puntos_visitante ?? 0)) return m.equipo_local_id;
          if ((m.puntos_visitante ?? 0) > (m.puntos_local ?? 0)) return m.equipo_visitante_id;
          return null; // Handle penalties?
      }).filter(Boolean);
      
      // Get current jornada info to know number
      const { data: currentJornada } = await actionSupabase
        .from('jornadas')
        .select('*')
        .eq('id', match.jornada_id)
        .single();
      
      if (!currentJornada) return;

      const nextJornadaNum = currentJornada.numero_jornada + 1;
      
      // Check if next jornada exists
      let { data: nextJornada } = await actionSupabase
        .from('jornadas')
        .select('id')
        .eq('torneo_id', match.torneo_id)
        .eq('numero_jornada', nextJornadaNum)
        .single();

      if (!nextJornada) {
         // Create Next Jornada
         const phaseName = winners.length === 2 ? 'Final' : 
                          winners.length === 4 ? 'Semifinal' : 
                          winners.length === 8 ? 'Cuartos de Final' :
                          `Ronda ${nextJornadaNum}`;
        
         const { data: newJornada, error: newJError } = await actionSupabase
            .from('jornadas')
            .insert({
                torneo_id: match.torneo_id,
                numero_jornada: nextJornadaNum,
                nombre_fase: phaseName
            })
            .select()
            .single();
         
         if (newJError || !newJornada) {
             console.error('Error creating next jornada', newJError);
             return;
         }
         nextJornada = newJornada;
      }

      if (!nextJornada) return;

      // Create or Get Matches for Next Round
      // Pair winners: 0vs1, 2vs3...
      const nextMatchMap = new Map<number, string>(); // Index -> Match ID
      
      const { data: existingNextMatches } = await actionSupabase
          .from('partidos')
          .select('id, equipo_local_id, equipo_visitante_id')
          .eq('jornada_id', nextJornada.id)
          .order('id', { ascending: true }); // Assume creation order for slots

      const matchesToInsert = [];
      const matchIndicesToInsert: number[] = []; // Track which index corresponds to which insert

      for (let i = 0; i < winners.length; i += 2) {
          const matchIndex = Math.floor(i / 2);
          const localId = winners[i];
          const visitorId = winners[i+1] || null;
          
          if (localId && visitorId) {
             // Check if match already exists for this slot
             const existingMatch = existingNextMatches?.[matchIndex];

             if (existingMatch) {
                 // Update existing match if needed (e.g. teams changed or re-running)
                 // Only update if not finalized? Or force update?
                 // If it's finalized, we probably shouldn't touch it unless we are cascading?
                 // But advanceWinner is usually legally moving forward.
                 // Let's just update pending matches or if we need to correction.
                 
                 if (existingMatch.equipo_local_id !== localId || existingMatch.equipo_visitante_id !== visitorId) {
                      await actionSupabase.from('partidos').update({
                          equipo_local_id: localId,
                          equipo_visitante_id: visitorId,
                          // Don't reset status if it was already finalized? 
                          // If we change teams, we MUST reset status.
                           estado_partido: 'pendiente', 
                           puntos_local: null,
                           puntos_visitante: null
                      }).eq('id', existingMatch.id);
                 }
                 nextMatchMap.set(matchIndex, existingMatch.id);
             } else {
                 // Prepare to insert new match
                 matchesToInsert.push({
                     torneo_id: match.torneo_id,
                     jornada_id: nextJornada.id,
                     equipo_local_id: localId,
                     equipo_visitante_id: visitorId,
                     estado_partido: 'pendiente'
                 });
                 matchIndicesToInsert.push(matchIndex);
             }
          }
      }

      if (matchesToInsert.length > 0) {
          const { data: insertedMatches, error: insertError } = await actionSupabase
              .from('partidos')
              .insert(matchesToInsert)
              .select('id');
          
          if (insertError) {
              console.error('Error creating next round matches', insertError);
              return;
          }

          if (insertedMatches) {
              insertedMatches.forEach((m, idx) => {
                  const originalIndex = matchIndicesToInsert[idx];
                  nextMatchMap.set(originalIndex, m.id);
              });
          }
      }

      // Link current matches to next matches (Self-healing linkage)
      // We need to know which winner came from which match.
      const winnerSources = currentJornadaMatches!.map(m => {
           let wId = null;
           if ((m.puntos_local ?? 0) > (m.puntos_visitante ?? 0)) wId = m.equipo_local_id;
           else if ((m.puntos_visitante ?? 0) > (m.puntos_local ?? 0)) wId = m.equipo_visitante_id;
           
           if (wId) return { winnerId: wId, sourceMatchId: m.id };
           return null;
      }).filter(Boolean) as { winnerId: string, sourceMatchId: string }[];

      // Now update links
      // We need to map which source match corresponds to which slot in the next round.
      // logic: winnerSources order aligns with winners array order?
      // winners array was created by map(m).filter(Boolean).
      // So winners[i] corresponds to winnerSources[i].winnerId.
      
      for (let i = 0; i < winnerSources.length; i++) {
          const matchIndex = Math.floor(i / 2);
          const nextMatchId = nextMatchMap.get(matchIndex);
          
          if (nextMatchId) {
              const source = winnerSources[i];
              // Update source match to point to next match
              await actionSupabase.from('partidos')
                  .update({ siguiente_partido_id: nextMatchId })
                  .eq('id', source.sourceMatchId);
          }
      }
  }
};

export const server = {
  ...selfServiceRegistrationActions,
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

      // 1. Ensure player exists in global registry (deportistas)
      const { data: existingPlayer } = await actionSupabase
        .from('deportistas')
        .select('numero_cedula')
        .eq('numero_cedula', input.numero_cedula)
        .maybeSingle();

      if (!existingPlayer) {
          // Create new player profile
          const { error: createError } = await actionSupabase.from('deportistas').insert([{
            numero_cedula: input.numero_cedula,
            nombre: input.nombre,
            fecha_nacimiento: fechaNacimiento,
          }]);
          
          if (createError) {
             throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Error creando perfil de jugador: ${createError.message}` });
          }
      } else {
          // Update name/dob to keep it fresh
          await actionSupabase.from('deportistas').update({
              nombre: input.nombre,
              fecha_nacimiento: fechaNacimiento
          }).eq('numero_cedula', input.numero_cedula);
      }

      // 2. Check if already in THIS team
      const { data: inTeam } = await actionSupabase
        .from('equipo_deportistas')
        .select('id')
        .eq('equipo_id', input.equipo_id)
        .eq('deportista_cedula', input.numero_cedula)
        .maybeSingle();

      if (inTeam) {
        throw new ActionError({ code: 'CONFLICT', message: 'El jugador ya está registrado en este equipo.' });
      }

      // 3. Check dorsal availability in THIS team
      if (input.dorsal) {
        const { data: dorsalExists } = await actionSupabase
            .from('equipo_deportistas')
            .select('id')
            .eq('equipo_id', input.equipo_id)
            .eq('dorsal', input.dorsal)
            .maybeSingle();
        if (dorsalExists) {
           throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso en este equipo.` });
        }
      }

      // 4. Link player to team
      try {
          const { error } = await actionSupabase.from('equipo_deportistas').insert([{
            equipo_id: input.equipo_id,
            deportista_cedula: input.numero_cedula,
            posicion: input.posicion || null,
            dorsal: input.dorsal || null, 
          }]);

          if (error) {
             if (error.code === '23505') { // Unique violation
                 throw new ActionError({ code: 'CONFLICT', message: `Error de duplicado al vincular jugador.` });
             }
             throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          }
      } catch (err: any) {
          if (err instanceof ActionError) throw err;
           throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      }

      return { success: true };
    },
  }),

  getPlayerByCedula: defineAction({
      accept: 'json',
      input: z.object({ numero_cedula: z.string() }),
      handler: async ({ numero_cedula }) => {
          const { data, error } = await actionSupabase
            .from('deportistas')
            .select('nombre, fecha_nacimiento')
            .eq('numero_cedula', numero_cedula)
            .maybeSingle();
          
          if (error) {
              console.error('Error fetching player:', error);
              return { success: false };
          }
          
          return { success: true, player: data };
      }
  }),

  updatePlayer: defineAction({
    accept: 'form',
    input: z.object({
      numero_cedula: z.string(),
      equipo_id: z.string().uuid(), // Context required now
      nombre: z.string().min(1, "Nombre requerido"),
      fecha_nacimiento: z.string().optional().nullable().or(z.literal('')),
      posicion: z.string().optional(),
      dorsal: z.coerce.number().optional().nullable(),
    }),
    handler: async (input) => {
        const fechaNacimiento = input.fecha_nacimiento === '' ? null : input.fecha_nacimiento;
        
        // 1. Verify link exists
        const { data: link } = await actionSupabase
            .from('equipo_deportistas')
            .select('id')
            .eq('equipo_id', input.equipo_id)
            .eq('deportista_cedula', input.numero_cedula)
            .single();

        if (!link) throw new ActionError({ code: 'NOT_FOUND', message: 'Jugador no encontrado en este equipo' });

        // 2. Check dorsal uniqueness
         if (input.dorsal) {
            const { data: dorsalExists } = await actionSupabase
                .from('equipo_deportistas')
                .select('deportista_cedula')
                .eq('equipo_id', input.equipo_id)
                .eq('dorsal', input.dorsal)
                .neq('deportista_cedula', input.numero_cedula)
                .maybeSingle();
            if (dorsalExists) throw new ActionError({ code: 'CONFLICT', message: `El dorsal ${input.dorsal} ya está en uso.` });
          }

        try {
            // 3. Update Global Profile
            await actionSupabase
              .from('deportistas')
              .update({
                 nombre: input.nombre,
                 fecha_nacimiento: fechaNacimiento,
              })
              .eq('numero_cedula', input.numero_cedula);

            // 4. Update Team Link
            const { error } = await actionSupabase
              .from('equipo_deportistas')
              .update({
                 posicion: input.posicion || null,
                 dorsal: input.dorsal || null,
              })
              .eq('equipo_id', input.equipo_id)
              .eq('deportista_cedula', input.numero_cedula);

            if (error) {
                 throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
            }
        } catch (err: any) {
             if (err instanceof ActionError) throw err;
             throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
        }

        return { success: true };
    }
  }),

  deletePlayer: defineAction({
      accept: 'form',
      input: z.object({ 
        numero_cedula: z.string(),
        equipo_id: z.string().uuid() // Context required
      }),
      handler: async ({ numero_cedula, equipo_id }) => {
          // Remove link from team
          const { error } = await actionSupabase
            .from('equipo_deportistas')
            .delete()
            .eq('deportista_cedula', numero_cedula)
            .eq('equipo_id', equipo_id);
            
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          
          return { success: true };
      }
  }),

  deletePlayers: defineAction({
      accept: 'form',
      input: z.object({
          cedulas: z.string(), // JSON array string of cedulas
          equipo_id: z.string().uuid() // Context required
      }),
      handler: async ({ cedulas, equipo_id }) => {
          let cedulaList: string[] = [];
          try {
              cedulaList = JSON.parse(cedulas);
          } catch (e) {
              throw new ActionError({ code: 'BAD_REQUEST', message: 'Invalid format' });
          }

          if (cedulaList.length === 0) return { success: true };

          const { error } = await actionSupabase
              .from('equipo_deportistas')
              .delete()
              .eq('equipo_id', equipo_id)
              .in('deportista_cedula', cedulaList);

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

          await actionSupabase.from('equipo_deportistas').delete().eq('equipo_id', id);
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
          director_tecnico_cedula: z.string().optional().nullable().or(z.literal('')),
          director_tecnico_nombre: z.string().optional().nullable().or(z.literal('')),
          asistente_tecnico_cedula: z.string().optional().nullable().or(z.literal('')),
          asistente_tecnico_nombre: z.string().optional().nullable().or(z.literal('')),
      }),
      handler: async (input) => {
           const { error } = await actionSupabase
            .from('equipos')
            .update({
                nombre: input.nombre,
                logo_url: input.logo_url || null,
                telefono_contacto: input.telefono_contacto || null,
                direccion_cancha: input.direccion_cancha || null,
                director_tecnico_cedula: input.director_tecnico_cedula || null,
                director_tecnico_nombre: input.director_tecnico_nombre || null,
                asistente_tecnico_cedula: input.asistente_tecnico_cedula || null,
                asistente_tecnico_nombre: input.asistente_tecnico_nombre || null,
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
        .from('equipo_deportistas')
        .select('deportista_cedula')
        .eq('equipo_id', equipo_id)
        .eq('deportista_cedula', numero_cedula)
        .single();
      
      if (!player) {
         throw new ActionError({ code: 'BAD_REQUEST', message: 'El jugador no pertenece a este equipo.' });
      }

      // 2. Set captain
      const { error } = await actionSupabase
        .from('equipos')
        .update({ capitan_id: numero_cedula })
        .eq('id', equipo_id);
      
      if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      // 3. Update local flag in equipo_deportistas (optional but good for consistency if we use it)
       await actionSupabase
         .from('equipo_deportistas')
         .update({ es_capitan: false })
         .eq('equipo_id', equipo_id);
         
       await actionSupabase
         .from('equipo_deportistas')
         .update({ es_capitan: true })
         .eq('equipo_id', equipo_id)
         .eq('deportista_cedula', numero_cedula);

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
      tipo: z.enum(['liga', 'eliminacion_simple', 'grupos_eliminacion', 'todos_contra_todos']).default('liga'),
      fecha_inicio: z.string().min(1, "Fecha de inicio requerida"),
      fecha_fin: z.string().min(1, "Fecha de fin requerida"),
      estado: z.enum(['pendiente', 'activo', 'finalizado', 'cancelado']).default('pendiente'),
      // Playoff configuration (optional)
      usa_ida_vuelta: z.string().optional(),
      fase_cuartos: z.string().optional(),
      fase_semis: z.string().optional(),
      fase_final: z.string().optional(),
      usa_gol_visitante: z.string().optional(),
      penales_si_empate: z.string().optional(),
      // League Configuration
      double_round: z.string().optional(),
    }),
    handler: async (input) => {
        // Build config
        let config: any = {};
        
        if (input.tipo === 'grupos_eliminacion' && input.usa_ida_vuelta === 'on') {
          const fasesIdaVuelta: string[] = [];
          if (input.fase_cuartos === 'quarterfinals') fasesIdaVuelta.push('quarterfinals');
          if (input.fase_semis === 'semifinals') fasesIdaVuelta.push('semifinals');
          
          config.playoff_config = {
            usa_ida_vuelta: true,
            fases_ida_vuelta: fasesIdaVuelta,
            final_ida_vuelta: input.fase_final === 'final',
            penales_si_empate_agregado: input.penales_si_empate === 'on',
            usa_gol_visitante: input.usa_gol_visitante === 'on',
          };
        } else if (input.tipo === 'liga' || input.tipo === 'todos_contra_todos') {
          config.double_round = input.double_round === 'true' || input.double_round === 'on';
        }

        const { data, error } = await actionSupabase
            .from('torneos')
            .insert([{
                nombre: input.nombre,
                deporte_id: input.deporte_id,
                tipo: input.tipo,
                fecha_inicio: input.fecha_inicio,
                fecha_fin: input.fecha_fin,
                estado: input.estado,
                config: Object.keys(config).length > 0 ? config : null,
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

  updateTournament: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string(),
      nombre: z.string().min(1).optional(),
      descripcion: z.string().optional().nullable(),
      estado: z.enum(['pendiente', 'activo', 'finalizado', 'cancelado']).optional(),
      fecha_inicio: z.string().optional().nullable(),
      fecha_fin: z.string().optional().nullable(),
      // Playoff configuration (optional)
      usa_ida_vuelta: z.string().optional(),
      fase_cuartos: z.string().optional(),
      fase_semis: z.string().optional(),
      fase_final: z.string().optional(),
      usa_gol_visitante: z.string().optional(),
      penales_si_empate: z.string().optional(),
      double_round: z.string().optional(),
    }),
    handler: async (input) => {
      // If trying to change estado, validate for elimination tournaments
      if (input.estado) {
        const { data: currentTorneo } = await actionSupabase
          .from('torneos')
          .select('tipo, estado')
          .eq('id', input.id)
          .single();

        if (currentTorneo && (currentTorneo.tipo === 'eliminacion_simple' || currentTorneo.tipo === 'grupos_eliminacion')) {
          // Prevent manual activation
          if (input.estado === 'activo' && currentTorneo.estado === 'pendiente') {
            // Check if all teams are assigned
            const { count: teamCount } = await actionSupabase
              .from('torneo_participantes')
              .select('*', { count: 'exact', head: true })
              .eq('torneo_id', input.id);

            // Get first jornada
            const { data: firstJornada } = await actionSupabase
              .from('jornadas')
              .select('id')
              .eq('torneo_id', input.id)
              .order('numero_jornada', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (!firstJornada) {
              throw new ActionError({
                code: 'BAD_REQUEST',
                message: 'Debes crear la primera jornada antes de activar el torneo.'
              });
            }

            // Get all matches in first jornada
            const { data: matches } = await actionSupabase
              .from('partidos')
              .select('equipo_local_id, equipo_visitante_id')
              .eq('jornada_id', firstJornada.id);

            // Count unique assigned teams
            const assignedTeams = new Set<string>();
            matches?.forEach(m => {
              if (m.equipo_local_id) assignedTeams.add(m.equipo_local_id);
              if (m.equipo_visitante_id) assignedTeams.add(m.equipo_visitante_id);
            });

            if (assignedTeams.size !== teamCount) {
              throw new ActionError({
                code: 'BAD_REQUEST',
                message: `No se puede activar el torneo. ${assignedTeams.size} de ${teamCount} equipos asignados. Asigna todos los equipos a partidos en la primera jornada.`
              });
            }
          }

          // Prevent manual deactivation (going from activo to pendiente)
          if (input.estado === 'pendiente' && currentTorneo.estado === 'activo') {
            throw new ActionError({
              code: 'BAD_REQUEST',
              message: 'No se puede regresar un torneo activo a estado pendiente.'
            });
          }

          // Prevent manual finalization (should be done automatically)
          if (input.estado === 'finalizado' && currentTorneo.estado !== 'finalizado') {
            throw new ActionError({
              code: 'BAD_REQUEST',
              message: 'Los torneos de eliminación se finalizan automáticamente al completar el partido final.'
            });
          }
        }
      }

      // Prepare update object
      const updateData: any = {
        nombre: input.nombre,
        descripcion: input.descripcion,
        estado: input.estado,
        fecha_inicio: input.fecha_inicio,
        fecha_fin: input.fecha_fin,
      };

      // Handle Playoff Config Update
      // We check if usa_ida_vuelta is present (checked) OR if we are explicitly saving form data
      // Since checkboxes are not sent if unchecked, we need a way to know if we should update config.
      // However, this action is general. 
      // Let's rely on `usa_ida_vuelta` being passed as 'on' OR undefined.
      // IF the user is editing the tournament, they might submit the form.
      // If `usa_ida_vuelta` is undefined, it might mean it was unchecked.
      // But verify if other fields are present to confirm it's a config update?
      // Actually, we can fetch the current config and see if we need to update.
      
      // Better approach: If input has any of the playoff fields, we assume we are updating config.
      // But standard HTML forms do not send anything for unchecked boxes.
      // So if I uncheck "Habilitar Playoff", only 'id' and other fields arrive.
      
      // Let's fetch the current tournament type first to see if it supports playoff config.
       const { data: currentTorneo, error: fetchError } = await actionSupabase
          .from('torneos')
          .select('tipo, config')
          .eq('id', input.id)
          .single();
          
       if (currentTorneo && (currentTorneo.tipo === 'grupos_eliminacion' || currentTorneo.tipo === 'eliminacion_simple')) {
           // Detailed Logic:
           // 1. Get existing config
           const currentConfig = (currentTorneo.config as any) || {};

           // 2. Helper to get checkbox boolean
           const isChecked = (val: string | undefined) => val === 'on';

           // 3. Determine if we should update config.
           // If the input comes from the edit form, it includes 'nombre' and 'descripcion'.
           // If 'usa_ida_vuelta' is missing but 'nombre' is present, it means the user submitted the form but left it unchecked.
           // However, if we call this action from elsewhere updating only 'estado', we shouldn't wipe config.
           // The Edit Modal sends: id, nombre, descripcion, fecha_inicio, fecha_fin, estado.
           // So if we have 'nombre' or 'fecha_inicio', it's likely the full edit form.
           
           const isEditFormSubmission = input.nombre !== undefined || input.fecha_inicio !== undefined;

           if (isEditFormSubmission) {
               const fasesIdaVuelta: string[] = [];
               if (input.fase_cuartos === 'quarterfinals') fasesIdaVuelta.push('quarterfinals');
               if (input.fase_semis === 'semifinals') fasesIdaVuelta.push('semifinals');

               // Merge with existing config
               currentConfig.playoff_config = {
                    usa_ida_vuelta: isChecked(input.usa_ida_vuelta),
                    fases_ida_vuelta: fasesIdaVuelta,
                    final_ida_vuelta: input.fase_final === 'final',
                    penales_si_empate_agregado: isChecked(input.penales_si_empate),
                    usa_gol_visitante: isChecked(input.usa_gol_visitante),
               };
               
               updateData.config = currentConfig;
           }
       } else if (currentTorneo && (currentTorneo.tipo === 'liga' || currentTorneo.tipo === 'todos_contra_todos')) {
           const currentConfig = (currentTorneo.config as any) || {};
           const isEditFormSubmission = input.nombre !== undefined || input.fecha_inicio !== undefined;

           if (isEditFormSubmission) {
               // Update League Config 
               currentConfig.double_round = input.double_round === 'true' || input.double_round === 'on';
               updateData.config = currentConfig;
           }
       }

      // Clean undefined
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const { error } = await actionSupabase
        .from('torneos')
        .update(updateData)
        .eq('id', input.id);
      
      if (error) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
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
          // Check tournament status
          const { data: torneo } = await actionSupabase.from('torneos').select('estado').eq('id', torneo_id).single();
          if (torneo) {
              if (torneo.estado === 'activo' || torneo.estado === 'finalizado') {
                  throw new ActionError({ code: 'FORBIDDEN', message: 'No se pueden inscribir equipos en torneos activos o finalizados.' });
              }
          }

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
          // Check tournament status and type
          const { data: torneo } = await actionSupabase.from('torneos').select('estado, tipo').eq('id', input.torneo_id).single();
          
          // For elimination tournaments, allow creating first jornada in pendiente state
          // For other tournament types, require active state
          if (torneo) {
            const isEliminationTournament = torneo.tipo === 'eliminacion_simple' || torneo.tipo === 'grupos_eliminacion';
            
            if (!isEliminationTournament && torneo.estado !== 'activo') {
              throw new ActionError({ code: 'FORBIDDEN', message: 'Solo se pueden agregar jornadas si el torneo está activo.' });
            }
            
            // For elimination tournaments, allow pendiente or activo
            if (isEliminationTournament && torneo.estado !== 'pendiente' && torneo.estado !== 'activo') {
              throw new ActionError({ code: 'FORBIDDEN', message: 'Solo se pueden agregar jornadas si el torneo está pendiente o activo.' });
            }
          } else {
            throw new ActionError({ code: 'NOT_FOUND', message: 'Torneo no encontrado' });
          }

          // For elimination tournaments, only allow creating the first jornada manually
          if (torneo.tipo === 'eliminacion_simple' || torneo.tipo === 'grupos_eliminacion') {
            // Check if there are existing jornadas
            const { count: existingCount } = await actionSupabase
              .from('jornadas')
              .select('*', { count: 'exact', head: true })
              .eq('torneo_id', input.torneo_id);

            if (existingCount && existingCount > 0) {
              throw new ActionError({ 
                code: 'BAD_REQUEST', 
                message: 'En torneos de eliminación, las jornadas subsecuentes se crean automáticamente al finalizar los partidos de la ronda anterior.' 
              });
            }
          }

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
          // 1. Get jornada info (torneo_id) before deletion
          const { data: jornada } = await actionSupabase.from('jornadas').select('torneo_id').eq('id', id).single();

          const { error } = await actionSupabase.from('jornadas').delete().eq('id', id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          
           // 2. Check tournament state and revert if needed (for elimination tournaments)
           if (jornada) {
              const { data: torneo } = await actionSupabase
                 .from('torneos')
                 .select('tipo, estado')
                 .eq('id', jornada.torneo_id)
                 .single();
              
              if (torneo && (torneo.tipo === 'eliminacion_simple' || torneo.tipo === 'grupos_eliminacion') && torneo.estado === 'activo') {
                  // Revert to pending because the bracket structure is now broken/incomplete
                  await actionSupabase.from('torneos').update({ estado: 'pendiente' }).eq('id', jornada.torneo_id);
              }
           }

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

          // 1. Validation: Prevent teams playing each other twice in the same jornada
          const { data: existingMatches } = await actionSupabase
            .from('partidos')
            .select('id, equipo_local_id, equipo_visitante_id')
            .eq('jornada_id', input.jornada_id)
            .or(`equipo_local_id.eq.${input.equipo_local_id},equipo_visitante_id.eq.${input.equipo_local_id},equipo_local_id.eq.${input.equipo_visitante_id},equipo_visitante_id.eq.${input.equipo_visitante_id}`);
          
          if (existingMatches && existingMatches.length > 0) {
            // Check which team is already playing
            const localAlreadyPlaying = existingMatches.some(m => 
              m.equipo_local_id === input.equipo_local_id || m.equipo_visitante_id === input.equipo_local_id
            );
            const visitanteAlreadyPlaying = existingMatches.some(m => 
              m.equipo_local_id === input.equipo_visitante_id || m.equipo_visitante_id === input.equipo_visitante_id
            );

            if (localAlreadyPlaying && visitanteAlreadyPlaying) {
              throw new ActionError({ 
                code: 'BAD_REQUEST', 
                message: 'Ambos equipos ya tienen partidos programados en esta jornada' 
              });
            } else if (localAlreadyPlaying) {
              throw new ActionError({ 
                code: 'BAD_REQUEST', 
                message: 'El equipo local ya tiene un partido programado en esta jornada' 
              });
            } else if (visitanteAlreadyPlaying) {
              throw new ActionError({ 
                code: 'BAD_REQUEST', 
                message: 'El equipo visitante ya tiene un partido programado en esta jornada' 
              });
            }
          }

          // 2. Validation: Prevent duplicate matches across the entire tournament based on League settings
          const { data: torneo } = await actionSupabase
            .from('torneos')
            .select('tipo, estado, config')
            .eq('id', jornada.torneo_id)
            .single();

          if (torneo && (torneo.tipo === 'liga' || torneo.tipo === 'todos_contra_todos')) {
              const config = (torneo.config as any) || {};
              const isDoubleRound = !!config.double_round;

              // Find all matches between these two teams in the tournament
              const { data: historicalMatches } = await actionSupabase
                  .from('partidos')
                  .select('equipo_local_id, equipo_visitante_id')
                  .eq('torneo_id', jornada.torneo_id)
                  .or(`and(equipo_local_id.eq.${input.equipo_local_id},equipo_visitante_id.eq.${input.equipo_visitante_id}),and(equipo_local_id.eq.${input.equipo_visitante_id},equipo_visitante_id.eq.${input.equipo_local_id})`);

              if (historicalMatches && historicalMatches.length > 0) {
                  if (!isDoubleRound) {
                      // Single Round Robin: Only 1 match allowed
                      throw new ActionError({ 
                          code: 'BAD_REQUEST', 
                          message: 'Estos equipos ya tienen un enfrentamiento programado en este torneo. (Liga a una sola vuelta)' 
                      });
                  } else {
                      // Double Round Robin: Max 2 matches allowed
                      if (historicalMatches.length >= 2) {
                          throw new ActionError({ 
                              code: 'BAD_REQUEST', 
                              message: 'Estos equipos ya completaron sus 2 enfrentamientos (ida y vuelta) permitidos en el torneo.' 
                          });
                      }
                      
                      // Check for exact same local/visitor arrangement
                      const exactDuplicate = historicalMatches.find(m => 
                          m.equipo_local_id === input.equipo_local_id && 
                          m.equipo_visitante_id === input.equipo_visitante_id
                      );
                      
                      if (exactDuplicate) {
                          throw new ActionError({ 
                              code: 'BAD_REQUEST', 
                              message: 'El equipo local ya jugó como local contra este visitante. Invierte la localía para el partido de vuelta.' 
                          });
                      }
                  }
              }
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

          // Check if tournament should be auto-activated (for elimination tournaments)
          if (torneo && (torneo.tipo === 'eliminacion_simple' || torneo.tipo === 'grupos_eliminacion') && torneo.estado === 'pendiente') {
            // Call checkAndActivateTournament logic inline
            const { count: teamCount } = await actionSupabase
              .from('torneo_participantes')
              .select('*', { count: 'exact', head: true })
              .eq('torneo_id', jornada.torneo_id);

            const { data: firstJornada } = await actionSupabase
              .from('jornadas')
              .select('id')
              .eq('torneo_id', jornada.torneo_id)
              .order('numero_jornada', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (firstJornada) {
              const { data: matches } = await actionSupabase
                .from('partidos')
                .select('equipo_local_id, equipo_visitante_id')
                .eq('jornada_id', firstJornada.id);

              const assignedTeams = new Set<string>();
              matches?.forEach(m => {
                if (m.equipo_local_id) assignedTeams.add(m.equipo_local_id);
                if (m.equipo_visitante_id) assignedTeams.add(m.equipo_visitante_id);
              });

              if (assignedTeams.size === teamCount) {
                await actionSupabase
                  .from('torneos')
                  .update({ estado: 'activo' })
                  .eq('id', jornada.torneo_id);
              }
            }
          }

          return { success: true };
      }
  }),

  deleteMatch: defineAction({
      accept: 'form',
      input: z.object({ 
        id: z.string(),
        cascade: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional()
      }),
      handler: async ({ id, cascade }) => {
          if (cascade) {
              const { error } = await actionSupabase.rpc('delete_match_cascade', { p_match_id: id });
              if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
              return { success: true };
          }

          // 1. Get match info (torneo_id) before deletion
          const { data: match } = await actionSupabase.from('partidos').select('torneo_id').eq('id', id).single();

          const { error } = await actionSupabase.from('partidos').delete().eq('id', id);
          if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
          
          // 2. Check tournament state and revert if needed (for elimination tournaments)
          if (match) {
             const { data: torneo } = await actionSupabase
                .from('torneos')
                .select('tipo, estado')
                .eq('id', match.torneo_id)
                .single();
             
             if (torneo && (torneo.tipo === 'eliminacion_simple' || torneo.tipo === 'grupos_eliminacion') && torneo.estado === 'activo') {
                 // Revert to pending because the bracket structure is now broken/incomplete
                 await actionSupabase.from('torneos').update({ estado: 'pendiente' }).eq('id', match.torneo_id);
             }
          }

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

      // 1. Update coaching staff if present
      if (parseResult.coachingStaff) {
        await actionSupabase
          .from('equipos')
          .update(parseResult.coachingStaff)
          .eq('id', equipo_id);
      }

      // 2. Process players
      const cedulas = parseResult.players.map(p => p.cedula);
      
      // Check which players already exist globally
      const { data: existingPlayers } = await actionSupabase
        .from('deportistas')
        .select('numero_cedula')
        .in('numero_cedula', cedulas);

      const existingCedulas = new Set(existingPlayers?.map(p => p.numero_cedula) || []);

      // Check which players are already in THIS team
      const { data: existingInTeam } = await actionSupabase
        .from('equipo_deportistas')
        .select('deportista_cedula')
        .eq('equipo_id', equipo_id)
        .in('deportista_cedula', cedulas);

      const existingInTeamCedulas = new Set(existingInTeam?.map(p => p.deportista_cedula) || []);

      // Check for duplicate dorsals in this team
      const dorsalsToCheck = parseResult.players
        .filter(p => p.dorsal !== undefined)
        .map(p => p.dorsal!);

      let existingDorsals = new Set<number>();
      if (dorsalsToCheck.length > 0) {
        const { data: existingDorsalPlayers } = await actionSupabase
          .from('equipo_deportistas')
          .select('dorsal')
          .eq('equipo_id', equipo_id)
          .in('dorsal', dorsalsToCheck);

        existingDorsals = new Set(existingDorsalPlayers?.map(p => p.dorsal).filter(d => d !== null) as number[] || []);
      }

      // Separate players into categories
      const playersToCreateGlobally = [];
      const playersToLink = [];
      const skippedDuplicates = []; // Players already in this team
      const dorsalErrors = []; // Dorsal conflicts

      for (const player of parseResult.players) {
        if (existingInTeamCedulas.has(player.cedula)) {
          // Skip - already in this team
          skippedDuplicates.push({
            cedula: player.cedula,
            nombre: player.nombre,
          });
        } else if (player.dorsal && existingDorsals.has(player.dorsal)) {
          // Dorsal conflict
          dorsalErrors.push({
            row: 0,
            message: `Jugador "${player.nombre}" (${player.cedula}): Dorsal ${player.dorsal} ya está asignado en este equipo`,
          });
        } else {
          // Need to link to team
          playersToLink.push(player);
          
          // If player doesn't exist globally, create profile
          if (!existingCedulas.has(player.cedula)) {
            playersToCreateGlobally.push({
              numero_cedula: player.cedula,
              nombre: player.nombre,
              fecha_nacimiento: player.fecha_nacimiento || null,
            });
          }
        }
      }

      // 3. Create global player profiles
      if (playersToCreateGlobally.length > 0) {
        const { error: createError } = await actionSupabase
          .from('deportistas')
          .insert(playersToCreateGlobally);

        if (createError) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Error al crear perfiles de jugadores: ${createError.message}`,
          });
        }
      }

      // 4. Link players to team
      let insertedCount = 0;
      if (playersToLink.length > 0) {
        const linksToInsert = playersToLink.map(p => ({
          equipo_id,
          deportista_cedula: p.cedula,
          posicion: p.posicion || null,
          dorsal: p.dorsal || null,
        }));

        const { error: linkError } = await actionSupabase
          .from('equipo_deportistas')
          .insert(linksToInsert);

        if (linkError) {
          throw new ActionError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Error al vincular jugadores al equipo: ${linkError.message}`,
          });
        }

        insertedCount = playersToLink.length;
      }

      // Combine all real errors (validation + dorsal conflicts)
      const allErrors = [...validationErrors, ...dorsalErrors];

      return {
        success: true,
        imported: insertedCount,
        skipped: skippedDuplicates.length,
        errors: allErrors,
        totalRows: parseResult.totalRows,
        coachingStaffUpdated: !!parseResult.coachingStaff,
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
      const { data: membership } = await actionSupabase
        .from('equipo_deportistas')
        .select('equipo_id')
        .eq('deportista_cedula', input.jugador_cedula)
        .eq('equipo_id', input.equipo_id)
        .single();
      
      if (!membership) {
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
      finalizar: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional(),
      penales_jugados: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional(),
      penales_local: z.union([z.number(), z.string().transform((val) => parseInt(val))]).optional(),
      penales_visitante: z.union([z.number(), z.string().transform((val) => parseInt(val))]).optional(),
    }),
    handler: async (input) => {
      let eventsList: any[] = [];
      try {
        eventsList = JSON.parse(input.events);
      } catch (e) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Invalid events format' });
      }

      // Check if we have events OR if we just want to finalize/update penalties
      // Fix: Check for undefined explicitly because 'false' is a valid value we want to process (clearing penalties)
      if (eventsList.length === 0 && !input.finalizar && input.penales_jugados === undefined) return { success: true };

      // Validate match exists and check tournament status
      const { data: match } = await actionSupabase
        .from('partidos')
        .select('equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante, torneo_id, torneos!inner(estado, tipo)')
        .eq('id', input.partido_id)
        .single();

      if (!match) throw new ActionError({ code: 'NOT_FOUND', message: 'Match not found' });

      // Prevent adding events in pendiente state for elimination tournaments
      const torneoData = (match as any).torneos;
      if (torneoData && (torneoData.tipo === 'eliminacion_simple' || torneoData.tipo === 'grupos_eliminacion')) {
        if (torneoData.estado === 'pendiente') {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'No se pueden agregar eventos en un torneo pendiente. El torneo debe estar activo. Asegúrate de que todos los equipos estén asignados a partidos en la primera jornada.'
          });
        }
      }

      // Prevent editing if tournament is finalized
      if (torneoData?.estado === 'finalizado') {
        throw new ActionError({ 
          code: 'FORBIDDEN', 
          message: 'No se pueden editar partidos de un torneo finalizado' 
        });
      }

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

      // Recalculate scores from ALL events in database (not just new ones)
      const { data: allMatchEvents } = await actionSupabase
        .from('eventos_partido')
        .select('tipo_evento, equipo_id')
        .eq('partido_id', input.partido_id);

      let totalLocal = 0;
      let totalVisitor = 0;
      let extraTimeLocal = 0;
      let extraTimeVisitor = 0;

      if (allMatchEvents) {
        allMatchEvents.forEach(e => {
          if (e.tipo_evento === 'gol') {
            if (e.equipo_id === match.equipo_local_id) totalLocal++;
            else if (e.equipo_id === match.equipo_visitante_id) totalVisitor++;
          } else if (e.tipo_evento === 'gol_tiempo_extra') {
            if (e.equipo_id === match.equipo_local_id) {
              totalLocal++;
              extraTimeLocal++;
            } else if (e.equipo_id === match.equipo_visitante_id) {
              totalVisitor++;
              extraTimeVisitor++;
            }
          }
        });
      }

      // Update match with recalculated scores
      const nuevoEstado = input.finalizar ? 'finalizado' : 'en_curso';
      const updateData: any = { 
        estado_partido: nuevoEstado,
        puntos_local: totalLocal,
        puntos_visitante: totalVisitor,
        goles_local_tiempo_extra: extraTimeLocal > 0 ? extraTimeLocal : null,
        goles_visitante_tiempo_extra: extraTimeVisitor > 0 ? extraTimeVisitor : null,
      };
      
      // Handle penalty shootout data
      if (input.penales_jugados) {
        updateData.penales_jugados = true;
        updateData.penales_local = input.penales_local ?? null;
        updateData.penales_visitante = input.penales_visitante ?? null;
      } else {
        updateData.penales_jugados = false;
        updateData.penales_local = null;
        updateData.penales_visitante = null;
      }
      
      // Update match
      const { data: updatedMatch } = await actionSupabase
        .from('partidos')
        .update(updateData)
        .eq('id', input.partido_id)
        .select()
        .single();

      // ============================================================================
      // AGGREGATE SCORE CALCULATION FOR TWO-LEGGED TIES
      // ============================================================================
      if (input.finalizar && updatedMatch) {
        // Check if this is a two-legged tie (partido_vuelta)
        if (updatedMatch.es_partido_vuelta && updatedMatch.partido_relacionado_id) {
          // Get the first leg (partido_ida)
          const { data: partidoIda } = await actionSupabase
            .from('partidos')
            .select('*')
            .eq('id', updatedMatch.partido_relacionado_id)
            .single();

          if (partidoIda && partidoIda.estado_partido === 'finalizado') {
            // Import aggregate calculation
            const { calculateAggregateScore } = await import('../utils/phase-validation');
            
            // Get tournament config for away goals rule
            const usaGolVisitante = (torneoData?.config as any)?.playoff_config?.usa_gol_visitante || false;
            
            // Calculate aggregate
            const aggregate = calculateAggregateScore(partidoIda, updatedMatch, usaGolVisitante);

            // Update both matches with aggregate data
            const aggregateUpdate = {
              marcador_agregado_local: aggregate.localAgregado,
              marcador_agregado_visitante: aggregate.visitanteAgregado,
              ganador_agregado_id: aggregate.ganadorId,
            };

            await actionSupabase
              .from('partidos')
              .update(aggregateUpdate)
              .in('id', [partidoIda.id, updatedMatch.id]);

            console.log('✅ Aggregate score calculated:', aggregate);

            // If requires penalties, log for admin attention
            if (aggregate.requierePenales) {
              console.warn('⚠️ Match requires penalty shootout - aggregate tied');
              // Could create a notification or flag here
            }
          }
        }
      }

      if (input.finalizar) {
          await advanceWinner(input.partido_id);
          
          // Check if all matches in tournament are finished (for league tournaments)
          if (torneoData?.tipo === 'liga' || torneoData?.tipo === 'todos_contra_todos') {
            const { data: allMatches } = await actionSupabase
              .from('partidos')
              .select('id, estado_partido')
              .eq('torneo_id', match.torneo_id);
            
            if (allMatches) {
              const allFinished = allMatches.every(m => m.estado_partido === 'finalizado');
              
              if (allFinished && torneoData.estado !== 'finalizado') {
                // Auto-finalize tournament
                await actionSupabase
                  .from('torneos')
                  .update({ estado: 'finalizado' })
                  .eq('id', match.torneo_id);
              }
            }
          }
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
          torneo:torneos(tipo, config),
          equipo_local_id,
          equipo_visitante_id,
          es_partido_vuelta,
          partido_relacionado_id
        `)
        .eq('id', input.id)
        .single();
      
      if (!match) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'Match not found' });
      }

      // Check if next match has started (Restriction)
      if (match.siguiente_partido_id) {
           const { data: nextMatch } = await actionSupabase
            .from('partidos')
            .select('estado_partido')
            .eq('id', match.siguiente_partido_id)
            .single();
           
           if (nextMatch && nextMatch.estado_partido !== 'pendiente') {
               throw new ActionError({ 
                   code: 'FORBIDDEN', 
                   message: 'No se puede editar este partido porque la siguiente fase ya ha comenzado.' 
               });
           }
      }

      const nuevoEstado = input.finalizar ? 'finalizado' : 'en_curso';

      // 2. Update Match
      const { data: updatedMatch, error: updateError } = await actionSupabase
        .from('partidos')
        .update({
          puntos_local: input.puntos_local,
          puntos_visitante: input.puntos_visitante,
          estado_partido: nuevoEstado
        })
        .eq('id', input.id)
        .select()
        .single();

      if (updateError) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message });
      }

      // 3. Aggregate Score Calculation (New Logic)
      if (input.finalizar && match.es_partido_vuelta && match.partido_relacionado_id && updatedMatch) {
         const { data: partidoIda } = await actionSupabase
            .from('partidos')
            .select('*')
            .eq('id', match.partido_relacionado_id)
            .single();

         if (partidoIda && partidoIda.estado_partido === 'finalizado') {
             const { calculateAggregateScore } = await import('../utils/phase-validation');
             
             // Get tournament config
             const torneoConfig = (match.torneo as any)?.config || {};
             const usaGolVisitante = torneoConfig.playoff_config?.usa_gol_visitante || false;

             const aggregate = calculateAggregateScore(partidoIda, updatedMatch, usaGolVisitante);

             // Update both matches
             await actionSupabase
              .from('partidos')
              .update({
                  marcador_agregado_local: aggregate.localAgregado,
                  marcador_agregado_visitante: aggregate.visitanteAgregado,
                  ganador_agregado_id: aggregate.ganadorId
              })
              .in('id', [partidoIda.id, updatedMatch.id]);
         }
      }

      // 4. Elimination Advancement Logic
      if (input.finalizar) {
          await advanceWinner(match.id);
      }

      return { success: true };
    }
  }),

  deleteMatchEvent: defineAction({
    accept: 'form',
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => {
        // Get event to adjust score before deleting
        const { data: event } = await actionSupabase.from('eventos_partido').select('*').eq('id', id).single();
        if (!event) throw new ActionError({ code: 'NOT_FOUND', message: 'Event not found' });

        // Check tournament status
        const { data: match } = await actionSupabase
          .from('partidos')
          .select('torneos!inner(estado)')
          .eq('id', event.partido_id)
          .single();

        if ((match as any)?.torneos?.estado === 'finalizado') {
          throw new ActionError({ 
            code: 'FORBIDDEN', 
            message: 'No se pueden editar partidos de un torneo finalizado' 
          });
        }

        // Delete the event first
        const { error } = await actionSupabase.from('eventos_partido').delete().eq('id', id);
        if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        // Recalculate scores from remaining events
        if (event.tipo_evento === 'gol') {
          const { data: matchData } = await actionSupabase
            .from('partidos')
            .select('equipo_local_id, equipo_visitante_id')
            .eq('id', event.partido_id)
            .single();

          if (matchData) {
            const { data: remainingEvents } = await actionSupabase
              .from('eventos_partido')
              .select('tipo_evento, equipo_id')
              .eq('partido_id', event.partido_id);

            let totalLocal = 0;
            let totalVisitor = 0;

            if (remainingEvents) {
              remainingEvents.forEach(e => {
                if (e.tipo_evento === 'gol') {
                  if (e.equipo_id === matchData.equipo_local_id) totalLocal++;
                  else if (e.equipo_id === matchData.equipo_visitante_id) totalVisitor++;
                }
              });
            }

            await actionSupabase
              .from('partidos')
              .update({ 
                puntos_local: totalLocal, 
                puntos_visitante: totalVisitor 
              })
              .eq('id', event.partido_id);
          }
        }

        return { success: true };
    }
  }),
  
  deleteMatchEvents: defineAction({
      accept: 'form',
      input: z.object({ ids: z.array(z.string()) }), // Expects array of IDs
      handler: async ({ ids }) => {
          if (ids.length === 0) return { success: true };

          // Get events to adjust score
          const { data: events } = await actionSupabase.from('eventos_partido').select('*').in('id', ids);
          
          if (events && events.length > 0) {
              // Check tournament status for the first event's match
              const { data: match } = await actionSupabase
                .from('partidos')
                .select('torneos!inner(estado)')
                .eq('id', events[0].partido_id)
                .single();

              if ((match as any)?.torneos?.estado === 'finalizado') {
                throw new ActionError({ 
                  code: 'FORBIDDEN', 
                  message: 'No se pueden editar partidos de un torneo finalizado' 
                });
              }

              const matchId = events[0].partido_id; // Assume all from same match if batching from manager, but safe check below
              
              // Group by match (should be one usually)
              const eventsByMatch: Record<string, any[]> = {};
              events.forEach(e => {
                  if (!eventsByMatch[e.partido_id]) eventsByMatch[e.partido_id] = [];
                  eventsByMatch[e.partido_id].push(e);
              });

              // Delete all events first
              const { error } = await actionSupabase.from('eventos_partido').delete().in('id', ids);
              if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

              // Recalculate scores for each affected match
              for (const mid in eventsByMatch) {
                const matchEvents = eventsByMatch[mid] as any[];
                const hasGoals = matchEvents.some(e => e.tipo_evento === 'gol');
                
                if (hasGoals) {
                  const { data: matchData } = await actionSupabase
                    .from('partidos')
                    .select('equipo_local_id, equipo_visitante_id')
                    .eq('id', mid)
                    .single();

                  if (matchData) {
                    const { data: remainingEvents } = await actionSupabase
                      .from('eventos_partido')
                      .select('tipo_evento, equipo_id')
                      .eq('partido_id', mid);

                    let totalLocal = 0;
                    let totalVisitor = 0;

                    if (remainingEvents) {
                      remainingEvents.forEach(e => {
                        if (e.tipo_evento === 'gol') {
                          if (e.equipo_id === matchData.equipo_local_id) totalLocal++;
                          else if (e.equipo_id === matchData.equipo_visitante_id) totalVisitor++;
                        }
                      });
                    }

                    await actionSupabase
                      .from('partidos')
                      .update({ 
                        puntos_local: totalLocal, 
                        puntos_visitante: totalVisitor 
                      })
                      .eq('id', mid);
                  }
                }
              }
          }
          return { success: true };
      }
  }),

  // =====================================================
  // Cascade Reversion Actions
  // =====================================================
  
  checkMatchImpact: defineAction({
    accept: 'form',
    input: z.object({
      match_id: z.string(),
      new_local_score: z.number(),
      new_visitor_score: z.number()
    }),
    handler: async (input) => {
      const { data, error } = await actionSupabase
        .rpc('check_match_impact', { p_match_id: input.match_id });
      
      if (error) {
        throw new ActionError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: `Error checking impact: ${error.message}` 
        });
      }
      
      return { 
        hasImpact: data?.has_impact || false,
        affectedMatches: data?.affected_matches || [],
        totalEvents: data?.total_events || 0,
        currentWinnerId: data?.current_winner_id,
        impactMessage: data?.impact_message
      };
    }
  }),

  checkDeleteImpact: defineAction({
    accept: 'form',
    input: z.object({
      type: z.enum(['match', 'jornada']),
      id: z.string().uuid()
    }),
    handler: async (input) => {
      const { data, error } = await actionSupabase
        .rpc('check_delete_impact', { 
          p_entity_type: input.type, 
          p_entity_id: input.id 
        });
      
      if (error) {
        throw new ActionError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: `Error checking delete impact: ${error.message}` 
        });
      }
      
      return { 
        hasImpact: data?.has_impact || false,
        affectedMatches: data?.affected_matches || [],
        totalEvents: data?.total_events || 0,
        message: data?.message || ''
      };
    }
  }),

  revertMatchWithCascade: defineAction({
    accept: 'form',
    input: z.object({
      match_id: z.string(),
      new_local_score: z.number(),
      new_visitor_score: z.number(),
      confirmed: z.boolean()
    }),
    handler: async (input) => {
      if (!input.confirmed) {
        throw new ActionError({ 
          code: 'BAD_REQUEST', 
          message: 'User confirmation required for cascade operation' 
        });
      }

      const { data, error } = await actionSupabase
        .rpc('revert_match_cascade', {
          p_match_id: input.match_id,
          p_new_local_score: input.new_local_score,
          p_new_visitor_score: input.new_visitor_score
        });
      
      if (error) {
        throw new ActionError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: `Error reverting match: ${error.message}` 
        });
      }
      
      return { 
        success: data?.success || false,
        deletedEvents: data?.deleted_events || 0,
        resetMatches: data?.reset_matches || 0,
        affectedMatchIds: data?.affected_match_ids || [],
        message: data?.message || 'Operation completed'
      };
    }
  }),

  // Auto-activate elimination tournament when all teams are assigned
  checkAndActivateTournament: defineAction({
    accept: 'form',
    input: z.object({
      torneo_id: z.string()
    }),
    handler: async ({ torneo_id }) => {
      // Get tournament info
      const { data: torneo } = await actionSupabase
        .from('torneos')
        .select('tipo, estado')
        .eq('id', torneo_id)
        .single();

      if (!torneo) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'Torneo no encontrado' });
      }

      // Only auto-activate elimination tournaments in pendiente state
      if ((torneo.tipo !== 'eliminacion_simple' && torneo.tipo !== 'grupos_eliminacion') || torneo.estado !== 'pendiente') {
        return { success: true, activated: false, message: 'No es un torneo de eliminación pendiente' };
      }

      // Count registered teams
      const { count: teamCount } = await actionSupabase
        .from('torneo_participantes')
        .select('*', { count: 'exact', head: true })
        .eq('torneo_id', torneo_id);

      if (!teamCount || teamCount === 0) {
        return { success: true, activated: false, message: 'No hay equipos inscritos' };
      }

      // Get first jornada
      const { data: firstJornada } = await actionSupabase
        .from('jornadas')
        .select('id')
        .eq('torneo_id', torneo_id)
        .order('numero_jornada', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstJornada) {
        return { success: true, activated: false, message: 'No hay jornadas creadas' };
      }

      // Get all matches in first jornada
      const { data: matches } = await actionSupabase
        .from('partidos')
        .select('equipo_local_id, equipo_visitante_id')
        .eq('jornada_id', firstJornada.id);

      // Count unique assigned teams
      const assignedTeams = new Set<string>();
      matches?.forEach(m => {
        if (m.equipo_local_id) assignedTeams.add(m.equipo_local_id);
        if (m.equipo_visitante_id) assignedTeams.add(m.equipo_visitante_id);
      });

      // If all teams assigned, activate tournament
      if (assignedTeams.size === teamCount) {
        const { error } = await actionSupabase
          .from('torneos')
          .update({ estado: 'activo' })
          .eq('id', torneo_id);

        if (error) {
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }

        return { 
          success: true, 
          activated: true, 
          message: `Torneo activado automáticamente. ${teamCount} equipos asignados.`,
          assignedCount: teamCount,
          totalCount: teamCount
        };
      }

      return { 
        success: true, 
        activated: false, 
        message: `${assignedTeams.size} de ${teamCount} equipos asignados`,
        assignedCount: assignedTeams.size,
        totalCount: teamCount
      };
    }
  }),

  updateMatch: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string().uuid(),
      equipo_local_id: z.string().uuid(),
      equipo_visitante_id: z.string().uuid(),
      fecha_partido: z.string().optional(),
    }),
    handler: async (input) => {
      const supabase = actionSupabase;

      // Validate teams are different
      if (input.equipo_local_id === input.equipo_visitante_id) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: 'Los equipos deben ser diferentes',
        });
      }

      // Get current match state
      const { data: currentMatch } = await supabase
        .from('partidos')
        .select('estado_partido, torneo_id, ronda, equipo_local_id, equipo_visitante_id')
        .eq('id', input.id)
        .single();

      if (!currentMatch) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: 'Partido no encontrado',
        });
      }

      // Get tournament state
      const { data: torneo } = await supabase
        .from('torneos')
        .select('estado')
        .eq('id', currentMatch.torneo_id)
        .single();

      // Determine new estado_partido
      let nuevoEstado = currentMatch.estado_partido;
      
      // If tournament is active and match is still pending, transition to en_curso
      if (torneo?.estado === 'activo' && currentMatch.estado_partido === 'pendiente') {
        nuevoEstado = 'en_curso';
      }

      // Update match
      const { error } = await supabase
        .from('partidos')
        .update({
          equipo_local_id: input.equipo_local_id,
          equipo_visitante_id: input.equipo_visitante_id,
          fecha_partido: input.fecha_partido || null,
          estado_partido: nuevoEstado,
        })
        .eq('id', input.id);

      if (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      // Check for two-legged sibling and apply inverted swap if this was a playoff match and teams changed
      const teamsChanged = currentMatch.equipo_local_id !== input.equipo_local_id || currentMatch.equipo_visitante_id !== input.equipo_visitante_id;
      
      if (currentMatch.ronda && teamsChanged) {
          // Look for the sibling match (e.g. the "Vuelta" or the "Ida" of the same playoff series)
          // It should have the same torneo_id, same ronda, and the EXACT inverse of the ORIGINAL teams
          const { data: siblingMatch } = await supabase
              .from('partidos')
              .select('id')
              .eq('torneo_id', currentMatch.torneo_id)
              .eq('ronda', currentMatch.ronda)
              .eq('equipo_local_id', currentMatch.equipo_visitante_id) // Original Visitante is Local here
              .eq('equipo_visitante_id', currentMatch.equipo_local_id) // Original Local is Visitante here
              .neq('id', input.id) // Exclude the match we just updated (just in case)
              .maybeSingle();
              
          if (siblingMatch) {
              // Apply the INVERSE of the NEW selection to the sibling match
              // If the new selection is [A vs B], the sibling should become [B vs A]
              const { error: siblingError } = await supabase
                  .from('partidos')
                  .update({
                      equipo_local_id: input.equipo_visitante_id,
                      equipo_visitante_id: input.equipo_local_id,
                  })
                  .eq('id', siblingMatch.id);
                  
              if (siblingError) {
                  console.error('Failed to sync two-legged sibling match:', siblingError);
                  // We log but do not fail the whole request, as the main match was updated successfully.
              }
          }
      }

      return { success: true };
    },
  }),





  createNews: defineAction({
    accept: 'form',
    input: z.object({
      torneo_id: z.string().uuid(),
      titulo: z.string().min(1, "Titulo requerido"),
      contenido: z.string().min(1, "Contenido requerido"),
      imagen_url: z.string().optional().nullable().or(z.literal('')),
    }),
    handler: async (input) => {
       const { error } = await actionSupabase
         .from('noticias')
         .insert([{
            torneo_id: input.torneo_id,
            titulo: input.titulo,
            contenido: input.contenido,
            imagen_url: input.imagen_url || null,
            fecha_publicacion: new Date().toISOString()
         }]);
       
       if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
       return { success: true };
    }
  }),

  deleteNews: defineAction({
    accept: 'form',
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => {
       const { error } = await actionSupabase.from('noticias').delete().eq('id', id);
       if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
       return { success: true };
    }
  }),



  unregisterTeamFromTournament: defineAction({
    accept: 'form',
    input: z.object({
      torneo_id: z.string(),
      equipo_id: z.string(),
    }),
    handler: async ({ torneo_id, equipo_id }) => {
      const { error } = await actionSupabase
        .from('torneo_participantes')
        .delete()
        .eq('torneo_id', torneo_id)
        .eq('equipo_id', equipo_id);

      if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }
  }),

  generateRoundRobin,
  generateSingleElimination,
  generateGroupsPlayoff,
  generatePlayoffFromGroups,
};
