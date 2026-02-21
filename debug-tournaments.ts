
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTournaments() {
  const { data: torneos, error } = await supabase
    .from('torneos')
    .select('id, nombre, tipo, estado');

  if (error) {
    console.error(error);
    return;
  }

  console.log('Tournaments:', torneos);
}

listTournaments();
