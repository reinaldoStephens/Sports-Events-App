import { useState, useEffect } from 'react';
import { actions } from 'astro:actions';

interface Player {
  numero_cedula: string;
  nombre: string;
  dorsal?: number;
  equipo_id: string; // Added to filter players by team
}

interface MatchEvent {
  id: string;
  tipo_evento: string;
  minuto: number;
  jugador_cedula: string;
  equipo_id: string;
  jugador?: { nombre: string; dorsal?: number };
}

interface MatchData {
  partidoId: string;
  equipoLocalId: string;
  equipoLocalNombre: string;
  equipoVisitanteId: string;
  equipoVisitanteNombre: string;
}

export default function MatchEventsManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [eventos, setEventos] = useState<MatchEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<Partial<MatchEvent>[]>([]); // New state for batch
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState('');
  const [minuto, setMinuto] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      const { match, events, allPlayers } = event.detail;
      setMatchData({
        partidoId: match.id,
        equipoLocalId: match.equipo_local_id,
        equipoLocalNombre: match.local.nombre,
        equipoVisitanteId: match.equipo_visitante_id,
        equipoVisitanteNombre: match.visitante.nombre
      });
      setEventos(events || []);
      setPendingEvents([]); // Reset pending
      setPlayers(allPlayers || []);
      setIsOpen(true);
      
      // Default selections
      setEquipoSeleccionado('');
      setJugadorSeleccionado('');
      setMinuto('');
    };

    window.addEventListener('open-match-manager', handleOpen as any);
    return () => window.removeEventListener('open-match-manager', handleOpen as any);
  }, []);

  if (!isOpen || !matchData) return null;

  // Merge server events with pending events for display
  const allEvents = [
    ...eventos, 
    ...pendingEvents.map((pe, idx) => ({
      ...pe, 
      id: `pending-${idx}`,  // Temp ID
      jugador: players.find(p => p.numero_cedula === pe.jugador_cedula)
    }))
  ] as MatchEvent[];

  const sortedEvents = allEvents.sort((a, b) => a.minuto - b.minuto);
  
  // Filter players for selected team
  const jugadoresDisponibles = players.filter(p => p.equipo_id === equipoSeleccionado);

  // Calculate score (Server + Pending)
  const golesLocal = allEvents.filter(e => e.equipo_id === matchData.equipoLocalId && e.tipo_evento === 'gol').length;
  const golesVisitante = allEvents.filter(e => e.equipo_id === matchData.equipoVisitanteId && e.tipo_evento === 'gol').length;

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipoSeleccionado || !jugadorSeleccionado || !minuto) return;

    // Add to pending instead of server immediately
    const newEvent = {
        tipo_evento: 'gol',
        equipo_id: equipoSeleccionado,
        jugador_cedula: jugadorSeleccionado,
        minuto: parseInt(minuto),
        partido_id: matchData.partidoId
    };

    setPendingEvents([...pendingEvents, newEvent]);

    // Reset form
    setMinuto('');
    setJugadorSeleccionado('');
    // Keep team selected for convenience or reset? Let's keep team.
  };

  const handleDeleteEvent = (eventId: string) => {
    // If pending, just remove from state
    if (eventId.startsWith('pending-')) {
        const index = parseInt(eventId.replace('pending-', ''));
        const newPending = [...pendingEvents];
        newPending.splice(index, 1);
        setPendingEvents(newPending);
        return;
    }

    // Normal server delete (keep existing logic)
    const showConfirm = (window as any).showConfirm;
    
    if (typeof showConfirm === 'function') {
      showConfirm('Eliminar Gol', '¿Estás seguro de que deseas eliminar este gol? Esta acción no se puede deshacer.', async () => {
        setLoading(true);
        try {
          const formData = new FormData();
          formData.append('id', eventId);
          const { error } = await actions.deleteMatchEvent(formData);
          if (error) {
            alert(error.message);
            setLoading(false);
          } else {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('msg', 'Gol eliminado correctamente');
            currentUrl.searchParams.set('type', 'success');
            window.location.href = currentUrl.toString();
          }
        } catch (err: any) {
          alert(err.message);
          setLoading(false);
        }
      });
    } else {
        // Fallback...
        if (!confirm('Eliminar gol?')) return;
        // ... (reuse same logic if needed, but showConfirm should exist)
    }
  };

  const handleSaveChanges = async () => {
      // Allow save even if no events, if we want to finalize
      setLoading(true);

      try {
          const finalizar = (document.getElementById('check-finalizar-events') as HTMLInputElement)?.checked;
          
          const formData = new FormData();
          formData.append('partido_id', matchData.partidoId);
          formData.append('events', JSON.stringify(pendingEvents));
          if (finalizar) formData.append('finalizar', 'true');
          
          const { error } = await actions.batchSaveMatchEvents(formData);
          
          if (error) {
              alert(error.message);
              setLoading(false);
          } else {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('msg', 'Eventos guardados correctamente');
            currentUrl.searchParams.set('type', 'success');
            window.location.href = currentUrl.toString();
          }
      } catch (err: any) {
          alert(err.message);
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !loading && setIsOpen(false)}></div>
      <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
        
        <button 
          onClick={() => setIsOpen(false)}
          disabled={loading}
          className="absolute top-6 right-6 z-10 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h3 className="text-xl font-black uppercase tracking-tighter mb-8 text-center">Goles y Eventos</h3>

        <div className="space-y-8">
           {/* Scoreboard */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
             {/* Pending Changes Indicator */}
             {pendingEvents.length > 0 && (
                 <div className="absolute top-0 left-0 w-full bg-yellow-100 text-yellow-800 text-[10px] font-bold text-center py-1 uppercase tracking-widest border-b border-yellow-200">
                     Hay cambios sin guardar
                 </div>
             )}

            <div className="flex items-center justify-center gap-8 mt-2">
              <div className="text-center w-1/3">
                <p className="text-sm font-bold text-slate-600 mb-2 truncate">{matchData.equipoLocalNombre}</p>
                <p className={`text-6xl font-black transition-colors ${pendingEvents.some(e => e.equipo_id === matchData.equipoLocalId) ? 'text-blue-600' : 'text-slate-900'}`}>{golesLocal}</p>
              </div>
              <div className="text-3xl font-black text-slate-300">-</div>
              <div className="text-center w-1/3">
                <p className="text-sm font-bold text-slate-600 mb-2 truncate">{matchData.equipoVisitanteNombre}</p>
                <p className={`text-6xl font-black transition-colors ${pendingEvents.some(e => e.equipo_id === matchData.equipoVisitanteId) ? 'text-blue-600' : 'text-slate-900'}`}>{golesVisitante}</p>
              </div>
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-4">
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Historial</h4>
             {sortedEvents.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {sortedEvents.map((evento) => (
                    <div key={evento.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors shadow-sm ${evento.id.startsWith('pending') ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                      <div className="flex items-center gap-4">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border ${evento.id.startsWith('pending') ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                          {evento.minuto}'
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {evento.jugador?.nombre || 'Jugador desconocido'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {evento.equipo_id === matchData.equipoLocalId ? matchData.equipoLocalNombre : matchData.equipoVisitanteNombre}
                          </p>
                        </div>
                      </div>
                      
                      {!evento.id.startsWith('pending') ? (
                          <button 
                            onClick={() => handleDeleteEvent(evento.id)}
                            disabled={loading}
                            className="text-red-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                      ) : (
                          <button 
                            onClick={() => handleDeleteEvent(evento.id)}
                            className="text-slate-400 hover:text-red-500 p-2"
                            title="Quitar (no guardado)"
                          >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                      )}
                    </div>
                  ))}
                </div>
             ) : (
                <p className="text-center text-slate-400 text-xs py-8 italic">No hay goles registrados</p>
             )}
          </div>

          {/* Add Form */}
          <form onSubmit={handleAddEvent} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Registrar Nuevo Gol</h4>
             
             <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 sm:col-span-5">
                   <select 
                      value={equipoSeleccionado}
                      onChange={(e) => {
                        setEquipoSeleccionado(e.target.value);
                        setJugadorSeleccionado('');
                      }}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                   >
                      <option value="">Seleccionar Equipo...</option>
                      <option value={matchData.equipoLocalId}>{matchData.equipoLocalNombre}</option>
                      <option value={matchData.equipoVisitanteId}>{matchData.equipoVisitanteNombre}</option>
                   </select>
                </div>
                
                <div className="col-span-8 sm:col-span-5">
                   <select
                      value={jugadorSeleccionado}
                      onChange={(e) => setJugadorSeleccionado(e.target.value)}
                      required
                      disabled={!equipoSeleccionado}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                   >
                      <option value="">Jugador...</option>
                      {jugadoresDisponibles.map(j => (
                        <option key={j.numero_cedula} value={j.numero_cedula}>
                          {j.dorsal ? `#${j.dorsal} ` : ''}{j.nombre}
                        </option>
                      ))}
                   </select>
                </div>

                <div className="col-span-4 sm:col-span-2">
                   <input 
                      type="number"
                      value={minuto}
                      onChange={(e) => setMinuto(e.target.value)}
                      min="0"
                      max="130"
                      placeholder="Min"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                   />
                </div>
             </div>

             <div className="flex gap-4">
                 <button 
                    type="submit"
                    className="flex-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-sm transition-all"
                 >
                    Agregar a la lista
                 </button>
             </div>
          </form>


          {/* Global Save Button */}
          {(pendingEvents.length > 0 || true) && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col items-center gap-3 w-full px-4 max-w-md">
                   {/* Finalize Checkbox */}
                   <div className="bg-white px-6 py-3 rounded-full shadow-xl border border-blue-100 flex items-center gap-3 w-fit">
                        <input type="checkbox" id="check-finalizar-events" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
                        <label htmlFor="check-finalizar-events" className="text-xs font-bold text-slate-700 uppercase tracking-wide cursor-pointer select-none">
                            Finalizar Partido
                        </label>
                   </div>

                  <button
                      onClick={handleSaveChanges}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/40 flex items-center gap-3 transition-all active:scale-95 hover:scale-105 w-full justify-center"
                  >
                      <span>Guardar Cambios</span>

                      {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  </button>
              </div>
          )}

        </div>
      </div>
    </div>
  );
}
