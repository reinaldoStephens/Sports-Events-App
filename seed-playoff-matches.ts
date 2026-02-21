
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPlayoffMatches() {
  const torneoId = 'a4545d8f-4b17-47b1-8954-88fe70006857'; // Existing tournament
  console.log(`Seeding playoff matches for tournament ${torneoId}...`);

  // 1. Ensure tournament is in valid state and type
  await supabase
    .from('torneos')
    .update({ 
        tipo: 'eliminacion_simple', 
        estado: 'activo',
        config: {
            playoff_config: {
                usa_ida_vuelta: true,
                fases_ida_vuelta: ['semifinal', 'final'],
                final_ida_vuelta: true,
                usa_gol_visitante: false
            }
        }
    })
    .eq('id', torneoId);

  // 2. Create Teams if needed (assuming teams exist, getting 2)
  const { data: teams } = await supabase.from('equipos').select('id, nombre').limit(2);
  if (!teams || teams.length < 2) {
      console.error('Not enough teams');
      return;
  }
  const teamA = teams[0];
  const teamB = teams[1];

  // 3. Create Jornada for Semifinals
  const { data: jornada } = await supabase
    .from('jornadas')
    .insert({
        torneo_id: torneoId,
        numero_jornada: 3,
        nombre_fase: 'Semifinales',
        fecha_inicio: new Date().toISOString()
    })
    .select()
    .single();

  if (!jornada) {
      console.error('Failed to create jornada');
      return;
  }

  // 4. Create Matches (Ida y Vuelta)
  // Match 1: Ida
  const { data: matchIda } = await supabase
    .from('partidos')
    .insert({
        torneo_id: torneoId,
        jornada_id: jornada.id,
        equipo_local_id: teamA.id,
        equipo_visitante_id: teamB.id,
        fecha_partido: new Date().toISOString(),
        estado_partido: 'finalizado',
        puntos_local: 1,
        puntos_visitante: 0,
        ronda: 'semifinal',
        es_partido_vuelta: false
    })
    .select()
    .single();

  // Match 2: Vuelta (Linked to Ida)
  if (matchIda) {
      const { data: matchVuelta } = await supabase
        .from('partidos')
        .insert({
            torneo_id: torneoId,
            jornada_id: jornada.id,
            equipo_local_id: teamB.id,
            equipo_visitante_id: teamA.id,
            fecha_partido: new Date(Date.now() + 86400000).toISOString(),
            estado_partido: 'finalizado',
            puntos_local: 1,
            puntos_visitante: 0, // Aggregate 1-1
            ronda: 'semifinal',
            es_partido_vuelta: true,
            partido_relacionado_id: matchIda.id,
            // Pre-calculate aggregate for display testing
            marcador_agregado_local: 1,
            marcador_agregado_visitante: 1,
            ganador_agregado_id: null // Tie
        })
        .select()
        .single();
      
      console.log('Created Match Ida:', matchIda.id);
      console.log('Created Match Vuelta:', matchVuelta?.id);
  }

  console.log('Seeding complete.');
}

seedPlayoffMatches();
