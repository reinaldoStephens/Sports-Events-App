
import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const POST: APIRoute = async ({ params, redirect }) => {
  const { id } = params;
  
  if (!id) {
    return new Response('Torneo ID is required', { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Obtener todas las jornadas del torneo
    const { data: jornadas, error: jornadasError } = await supabase
      .from('jornadas')
      .select('id')
      .eq('torneo_id', id);

    if (jornadasError) {
      throw jornadasError;
    }

    if (!jornadas || jornadas.length === 0) {
    return redirect(`/admin/torneo/${id}?tab=jornadas&message=${encodeURIComponent('No hay jornadas para eliminar')}`);
    }

    const jornadaIds = jornadas.map(j => j.id);

    // Eliminar todos los partidos asociados (CASCADE debería hacerlo automáticamente)
    const { error: partidosError } = await supabase
      .from('partidos')
      .delete()
      .in('jornada_id', jornadaIds);

    if (partidosError) {
      throw partidosError;
    }

    // Eliminar las jornadas
    const { error: deleteError } = await supabase
      .from('jornadas')
      .delete()
      .eq('torneo_id', id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Todas las jornadas fueron eliminadas' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error deleting jornadas:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || 'Error al eliminar jornadas' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

