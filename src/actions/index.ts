import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { createClient } from '@supabase/supabase-js';
import { supabase as publicSupabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Use authenticated client if service role key is available (Bypasses RLS for Admin actions)
// Fallback to public client (might fail due to RLS if not authenticated)
const createServiceRoleClient = () => {
    if (serviceRoleKey) {
        return createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to public client (RLS may block actions).");
    return publicSupabase;
}

const actionSupabase = createServiceRoleClient();

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
      // DEBUG: Check env var
      if (!serviceRoleKey) {
         console.error("❌ CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing/undefined. Registration will likely fail.");
      }

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
};
