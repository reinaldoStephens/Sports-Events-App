import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ipyjwlxkvuozekwvmdug.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWp3bHhrdnVvemVrd3ZtZHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTg1MDksImV4cCI6MjA4MzM3NDUwOX0.ONYmaiJzhZKMPFsrvE2BXN5ZY5LaItfsgL5jN-FyEQY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase as s };
