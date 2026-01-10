import { defineMiddleware } from 'astro:middleware';
import { getSupabaseAdmin } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const isDashboard = context.url.pathname.startsWith('/admin');
  
  if (isDashboard) {
    const accessToken = context.cookies.get('sb-access-token')?.value;
    const refreshToken = context.cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return context.redirect('/login');
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      // Try refreshing? For now just redirect
      context.cookies.delete('sb-access-token', { path: '/' });
      context.cookies.delete('sb-refresh-token', { path: '/' });
      return context.redirect('/login');
    }

    // Check query for admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (profile?.role !== 'admin') {
        return context.redirect('/'); // Or a 403 page
    }

    context.locals.user = user;
  }

  return next();
});
