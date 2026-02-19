
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMatchesCorrect() {
  const torneoId = 'a4545d8f-4b17-47b1-8954-88fe70006857';
  console.log(`Fetching matches for tournament ${torneoId}...`);
  
  const { data: matches, error } = await supabase
    .from('partidos')
    .select('*')
    .eq('torneo_id', torneoId)
    .order('fecha_partido', { ascending: false });

  if (error) {
    console.error('Error fetching matches:', error);
    return;
  }

  console.log(`Found ${matches.length} matches.`);
  
  const returnMatches = matches.filter(m => m.es_partido_vuelta);
  console.log(`Return matches count: ${returnMatches.length}`);

  if (returnMatches.length > 0) {
    console.log('Return matches found:', returnMatches.map(m => ({
        id: m.id,
        local: m.puntos_local,
        visitante: m.puntos_visitante,
        estado: m.estado_partido,
        agregado_local: m.marcador_agregado_local,
        agregado_vis: m.marcador_agregado_visitante,
        ganador_agregado: m.ganador_agregado_id
    })));
  } else {
    console.log('No return matches found in this tournament.');
  }

  // Also check if any matches have "playoff" phase name
  const playoffMatches = matches.filter(m => m.ronda);
  console.log(`Playoff matches count: ${playoffMatches.length}`);
}

debugMatchesCorrect();
