import { defineMiddleware } from 'astro:middleware';
import { getSupabaseAdmin } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;

  if (accessToken && refreshToken) {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (user && !error) {
      context.locals.user = user;
    }
  }

  const isDashboard = context.url.pathname.startsWith('/admin');
  
  if (isDashboard) {
    if (!context.locals.user) {
       // Clear cookies if they existed but were invalid (handled partly above by getUser failure, but here purely if user is missing)
       if (accessToken) {
          context.cookies.delete('sb-access-token', { path: '/' });
          context.cookies.delete('sb-refresh-token', { path: '/' });
       }
       return context.redirect('/login');
    }

    const supabase = getSupabaseAdmin();
    // Check query for admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', context.locals.user.id)
        .single();
    
    if (profile?.role !== 'admin') {
        return context.redirect('/'); // Or a 403 page
    }
  }

  return next();
});
