import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client for RLS-compliant operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates a Supabase client with service role privileges.
 * This client bypasses RLS and should ONLY be used in server-side contexts (Actions, Middleware).
 */
export const getSupabaseAdmin = () => {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
