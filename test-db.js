import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const torneoId = '0814a2c1-7f1b-4b78-9ddc-0c6b2000e740';
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select('id, equipo_local_id, equipo_visitante_id, puntos_local, puntos_visitante, estado_partido, jornada:jornada_id (fase_tipo)')
    .eq('torneo_id', torneoId);
    
  console.log("Partidos:", partidos);
}

run();
