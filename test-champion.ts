import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getTournamentChampion } from './src/utils/champion.js';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: torneos } = await supabase
    .from('torneos')
    .select('id, nombre, tipo')
    .limit(3);

  console.log("Testing Torneos:", torneos);

  for (const t of torneos) {
    console.log(`Getting champion for: ${t.nombre} (${t.tipo})`);
    const champion = await getTournamentChampion(supabase, t.id, t.tipo);
    console.log("Champion:", champion);
  }
}

run();
