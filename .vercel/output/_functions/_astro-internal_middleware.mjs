import { d as defineMiddleware, s as sequence } from './chunks/index_Dtt547T2.mjs';
import { createClient } from '@supabase/supabase-js';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_BU5zBeAq.mjs';
import 'piccolore';
import './chunks/astro/server_CiWqt42D.mjs';
import 'clsx';

const supabaseUrl = "https://ipyjwlxkvuozekwvmdug.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWp3bHhrdnVvemVrd3ZtZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTg1MDksImV4cCI6MjA4MzM3NDUwOX0.ONYmaiJzhZKMPFsrvE2BXN5ZY5LaItfsgL5jN-FyEQY";
const onRequest$1 = defineMiddleware(async (context, next) => {
  const isDashboard = context.url.pathname.startsWith("/admin");
  if (isDashboard) {
    const accessToken = context.cookies.get("sb-access-token")?.value;
    const refreshToken = context.cookies.get("sb-refresh-token")?.value;
    if (!accessToken || !refreshToken) {
      return context.redirect("/login");
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      context.cookies.delete("sb-access-token", { path: "/" });
      context.cookies.delete("sb-refresh-token", { path: "/" });
      return context.redirect("/login");
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return context.redirect("/");
    }
    context.locals.user = user;
  }
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
