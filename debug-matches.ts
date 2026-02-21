
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMatches() {
  console.log('Fetching matches for tournament 9caa4ea8-3eb2-400c-adc2-c1ebb3f26dfd...');
  
  const { data: matches, error } = await supabase
    .from('partidos')
    .select('*')
    .eq('torneo_id', '9caa4ea8-3eb2-400c-adc2-c1ebb3f26dfd');

  if (error) {
    console.error('Error fetching matches:', error);
    return;
  }

  console.log(`Found ${matches.length} matches.`);
  
  const returnMatches = matches.filter(m => m.es_partido_vuelta);
  console.log(`Return matches count: ${returnMatches.length}`);

  if (returnMatches.length > 0) {
    console.log('First return match keys:', Object.keys(returnMatches[0]));
    console.log('First return match data:', returnMatches[0]);
    
    // Check specific columns
    const m = returnMatches[0];
    console.log('--------------------------------------------------');
    console.log(`Match ID: ${m.id}`);
    console.log(`Es vuelta: ${m.es_partido_vuelta}`);
    console.log(`Marcador Agregado Local: ${m.marcador_agregado_local} (${typeof m.marcador_agregado_local})`);
    console.log(`Marcador Agregado Visitante: ${m.marcador_agregado_visitante} (${typeof m.marcador_agregado_visitante})`);
    console.log(`Ganador Agregado ID: ${m.ganador_agregado_id}`);
    console.log('--------------------------------------------------');
  } else {
    console.log('No return matches found.');
  }
}

debugMatches();
