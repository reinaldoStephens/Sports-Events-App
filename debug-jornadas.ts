
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJornadas() {
  const torneoId = 'a4545d8f-4b17-47b1-8954-88fe70006857';
  console.log(`Checking jornadas for tournament ${torneoId}...`);
  
  const { data: jornadas, error } = await supabase
    .from('jornadas')
    .select('*')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error('Error fetching jornadas:', error);
    return;
  }

  console.log('Jornadas found:', jornadas);
}

checkJornadas();
