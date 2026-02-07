
import { generateRoundRobinHandler } from '../../../actions/generate-round-robin';
import { generateSingleEliminationHandler } from '../../../actions/generate-single-elimination';

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const { id } = params;
  
  if (!id) {
    return new Response('Torneo ID is required', { status: 400 });
  }

  const formData = await request.formData();
  const action = formData.get('action');

  try {
    // Obtener tipo de torneo y configuración
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    const torneoResponse = await fetch(
      `${supabaseUrl}/rest/v1/torneos?id=eq.${id}&select=tipo,config`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        }
      }
    );

    const torneos = await torneoResponse.json();
    const torneo = torneos[0];

    if (!torneo) {
      return new Response('Torneo not found', { status: 404 });
    }

    const config = (torneo.config || {}) as { double_round?: boolean; use_seeding?: boolean };

    let result;
    
    if (torneo.tipo === 'liga') {
      // Generar Round-Robin
      result = await generateRoundRobinHandler({
        torneoId: id,
        doubleRound: config.double_round || false,
      });
    } else if (torneo.tipo === 'eliminacion_simple') {
      // Generar Single Elimination
      result = await generateSingleEliminationHandler({
        torneoId: id,
        useSeeding: config.use_seeding || false,
      });
    } else {
      return new Response('Unsupported tournament type', { status: 400 });
    }

    // Adapt to action result format
    const resultData = result;
    const errorData = result;

    if (resultData.success) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: resultData.message || 'Fixture generado correctamente' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        message: resultData.message || errorData.message || 'Error desconocido al generar fixture' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('Error generating fixture:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || 'Error interno al generar fixture' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

