import { useState, useEffect } from 'react';
import { actions } from 'astro:actions';
import CascadeWarningModal from './CascadeWarningModal';

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
  estadoPartido: 'pendiente' | 'en_curso' | 'finalizado';
  estadoTorneo: 'pendiente' | 'activo' | 'finalizado' | 'cancelado';
  tipoTorneo: string;
  esPartidoVuelta?: boolean;
  marcadorAgregadoLocal?: number | null;
  marcadorAgregadoVisitante?: number | null;
}

interface PendingSaveData {
  finalizar: boolean;
  newLocalScore: number;
  newVisitorScore: number;
  deleteEventIds?: string[];
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
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  
  // Penalty shootout state
  const [penalesJugados, setPenalesJugados] = useState(false);
  const [penalesLocal, setPenalesLocal] = useState('');
  const [penalesVisitante, setPenalesVisitante] = useState('');
  
  // Cascade reversion state
  const [showCascadeModal, setShowCascadeModal] = useState(false);
  const [cascadeData, setCascadeData] = useState<any>(null);
  const [pendingSaveData, setPendingSaveData] = useState<PendingSaveData | null>(null);

  useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      const { match, events, allPlayers, torneoEstado, torneoTipo } = event.detail;

      setMatchData({
        partidoId: match.id,
        equipoLocalId: match.equipo_local_id,
        equipoLocalNombre: match.local?.nombre || match.equipo_local?.nombre || 'Local',
        equipoVisitanteId: match.equipo_visitante_id,
        equipoVisitanteNombre: match.visitante?.nombre || match.equipo_visitante?.nombre || 'Visitante',
        estadoPartido: match.estado_partido, // Assuming match object has estado_partido
        estadoTorneo: torneoEstado,
        tipoTorneo: torneoTipo,
        esPartidoVuelta: match.es_partido_vuelta,
        marcadorAgregadoLocal: match.marcador_agregado_local,
        marcadorAgregadoVisitante: match.marcador_agregado_visitante
      });
      
      // Ensure server events have player info (since we removed the join)
      const formattedEvents = (events || []).map((e: any) => ({
        ...e,
        jugador: e.jugador || (allPlayers || []).find((p: any) => p.numero_cedula === e.jugador_cedula)
      }));

      setEventos(formattedEvents);
      setPendingEvents([]); // Reset pending
      setSelectedEventIds([]); // Reset selection
      setPlayers(allPlayers || []);
      setIsOpen(true);
      
      // Default selections
      setEquipoSeleccionado('');
      setJugadorSeleccionado('');
      setMinuto('');
      
      // Load penalty data from match if exists
      setPenalesJugados(match.penales_jugados || false);
      setPenalesLocal(match.penales_local?.toString() || '');
      setPenalesVisitante(match.penales_visitante?.toString() || '');
    };

    window.addEventListener('open-match-manager', handleOpen as any);
    return () => window.removeEventListener('open-match-manager', handleOpen as any);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleToggleSelect = (id: string) => {
      setSelectedEventIds(prev => 
          prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
      );
  };

  const handleBulkDelete = () => {
       if (selectedEventIds.length === 0) return;
       
       const showConfirm = (window as any).showConfirm;
       const confirmMsg = `¿Eliminar ${selectedEventIds.length} eventos seleccionados?`;
       
       const executeDelete = async () => {
           setLoading(true);
           try {
               // Separate pending vs server
               const pendingToDelete = selectedEventIds.filter(id => id.startsWith('pending-'));
               const serverToDelete = selectedEventIds.filter(id => !id.startsWith('pending-'));
               
               // Delete pending (no cascade check needed)
               if (pendingToDelete.length > 0) {
                   const newPending = pendingEvents.filter((_, idx) => !pendingToDelete.includes(`pending-${idx}`));
                   setPendingEvents(newPending);
               }

               // Check if deleting server events affects finalized match
               if (serverToDelete.length > 0) {
                 // Check if any deleted events are goals
                 const deletedGoals = eventos.filter(e => 
                   serverToDelete.includes(e.id) && e.tipo_evento === 'gol'
                 );

                 // If deleting goals from a finalized match, check cascade impact
                 if (deletedGoals.length > 0 && matchData?.estadoPartido === 'finalizado') {
                   // Calculate new scores after deletion
                   const remainingGoalsLocal = allEvents.filter(e => 
                     !serverToDelete.includes(e.id) && 
                     e.equipo_id === matchData.equipoLocalId && 
                     e.tipo_evento === 'gol'
                   ).length;
                   
                   const remainingGoalsVisitor = allEvents.filter(e => 
                     !serverToDelete.includes(e.id) && 
                     e.equipo_id === matchData.equipoVisitanteId && 
                     e.tipo_evento === 'gol'
                   ).length;

                   // Check for cascade impact with new scores
                   const impactFormData = new FormData();
                   impactFormData.append('match_id', matchData.partidoId);
                   impactFormData.append('new_local_score', remainingGoalsLocal.toString());
                   impactFormData.append('new_visitor_score', remainingGoalsVisitor.toString());
                   
                   const { data: impactData, error: impactError } = await actions.checkMatchImpact(impactFormData);
                   
                   if (impactError) {
                     alert('Error al verificar impacto: ' + impactError.message);
                     setLoading(false);
                     return;
                   }
                   
                   if (impactData?.hasImpact) {
                     // Show cascade warning modal
                     setCascadeData(impactData);
                     setPendingSaveData({ 
                       finalizar: true, 
                       newLocalScore: remainingGoalsLocal, 
                       newVisitorScore: remainingGoalsVisitor,
                       deleteEventIds: serverToDelete 
                     });
                     setShowCascadeModal(true);
                     setLoading(false);
                     return;
                   }
                 }

                 // No cascade impact, proceed with normal deletion
                 const formData = new FormData();
                 serverToDelete.forEach(id => formData.append('ids', id));
                 
                 const { error } = await actions.deleteMatchEvents(formData);
                 if (error) throw error;
               }

               const currentUrl = new URL(window.location.href);
               currentUrl.searchParams.set('msg', 'Eventos eliminados');
               currentUrl.searchParams.set('type', 'success');
               window.location.href = currentUrl.toString();

           } catch (err: any) {
               alert(err.message);
               setLoading(false);
           }
       };

       if (typeof showConfirm === 'function') {
           showConfirm('Eliminar Eventos', confirmMsg, executeDelete);
       } else {
           if (confirm(confirmMsg)) executeDelete();
       }
  };

  // Early return if not open
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
  
  // Check if form should be disabled (elimination tournament in pendiente state)
  const isFormDisabled = matchData && 
    (matchData.tipoTorneo === 'eliminacion_simple' || matchData.tipoTorneo === 'grupos_eliminacion') && 
    matchData.estadoTorneo === 'pendiente';
  
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

    // Normal server delete
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
        if (!confirm('Eliminar gol?')) return;
    }
  };

  const handleSaveChanges = async () => {
      setLoading(true);
      try {
          // Recalculate current scores (Server + Pending)
          // We use the same calculation as rendered in the UI
          const currentLocalGoals = allEvents.filter(e => e.equipo_id === matchData.equipoLocalId && e.tipo_evento === 'gol').length;
          const currentVisitorGoals = allEvents.filter(e => e.equipo_id === matchData.equipoVisitanteId && e.tipo_evento === 'gol').length;
          
          const isDraw = currentLocalGoals === currentVisitorGoals;
          const finalizar = (document.getElementById('check-finalizar-events') as HTMLInputElement)?.checked;

          // Validation: Penalties
          let finalPenalesJugados = penalesJugados;
          let finalPenalesLocal: number | null = null;
          let finalPenalesVisitante: number | null = null;

          if (penalesJugados) {
              if (!isDraw && !matchData.esPartidoVuelta) {
                  // Auto-disable if not draw AND not return match
                  finalPenalesJugados = false;
              } else {
                  if (penalesLocal === '' || penalesVisitante === '') {
                      alert('Por favor ingresa el resultado de los penales.');
                      setLoading(false);
                      return;
                  }
                  finalPenalesLocal = parseInt(penalesLocal);
                  finalPenalesVisitante = parseInt(penalesVisitante);

                  if (finalPenalesLocal === finalPenalesVisitante) {
                       alert('Los penales no pueden terminar empatados.');
                       setLoading(false);
                       return;
                  }
              }
          }

          // Check for cascade impact if finalized
          const isMatchFinalized = matchData.estadoPartido === 'finalizado';
          
          if (isMatchFinalized && finalizar) {
             const impactFormData = new FormData();
             impactFormData.append('match_id', matchData.partidoId);
             impactFormData.append('new_local_score', currentLocalGoals.toString());
             impactFormData.append('new_visitor_score', currentVisitorGoals.toString());
             
             const { data: impactData, error: impactError } = await actions.checkMatchImpact(impactFormData);
             
             if (impactError) {
                 alert('Error al verificar impacto: ' + impactError.message);
                 setLoading(false);
                 return;
             }
             
             if (impactData?.hasImpact) {
                 setCascadeData(impactData);
                 setPendingSaveData({
                     finalizar: true,
                     newLocalScore: currentLocalGoals,
                     newVisitorScore: currentVisitorGoals
                 });
                 setShowCascadeModal(true);
                 setLoading(false);
                 return;
             }
          }

          // Save Data
          const formData = new FormData();
          formData.append('partido_id', matchData.partidoId);
          formData.append('finalizar', finalizar ? 'true' : 'false');
          
          // Penalty Data
          formData.append('penales_jugados', finalPenalesJugados ? 'true' : 'false');
          if (finalPenalesJugados && finalPenalesLocal !== null && finalPenalesVisitante !== null) {
              formData.append('penales_local', finalPenalesLocal.toString());
              formData.append('penales_visitante', finalPenalesVisitante.toString());
          }

          // Events
          const pendingEventsData = pendingEvents.map(e => ({
              ...e,
              partido_id: matchData.partidoId
          }));
          formData.append('events', JSON.stringify(pendingEventsData));

          const { error } = await actions.batchSaveMatchEvents(formData);

          if (error) {
               throw error;
          }

          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('msg', 'Cambios guardados correctamente');
          currentUrl.searchParams.set('type', 'success');
          window.location.href = currentUrl.toString();

      } catch (err: any) {
          console.error(err);
          // Check for specific errors
          if (err.message && (err.message.includes('torneo pendiente') || err.message.includes('torneo debe estar activo'))) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('msg', err.message);
            currentUrl.searchParams.set('type', 'error');
            window.location.href = currentUrl.toString();
            return;
          }
          
          alert(err.message || 'Error al guardar cambios');
          setLoading(false);
      }
  };
  
  const handleCascadeConfirm = async () => {
    setShowCascadeModal(false);
    setLoading(true);
    
    if (!pendingSaveData) {
      setLoading(false);
      return;
    }
    
    try {
      // Execute cascade reversion
      const cascadeFormData = new FormData();
      cascadeFormData.append('match_id', matchData!.partidoId);
      cascadeFormData.append('new_local_score', pendingSaveData.newLocalScore.toString());
      cascadeFormData.append('new_visitor_score', pendingSaveData.newVisitorScore.toString());
      cascadeFormData.append('confirmed', 'true');
      
      const { data: cascadeResult, error: cascadeError } = await actions.revertMatchWithCascade(cascadeFormData);
      
      if (cascadeError) {
        alert('Error en reversión en cascada: ' + cascadeError.message);
        setLoading(false);
        return;
      }
      
      // Check if this is a delete operation
      if (pendingSaveData.deleteEventIds && pendingSaveData.deleteEventIds.length > 0) {
        // Delete the events
        const deleteFormData = new FormData();
        pendingSaveData.deleteEventIds.forEach(id => deleteFormData.append('ids', id));
        
        const { error: deleteError } = await actions.deleteMatchEvents(deleteFormData);
        
        if (deleteError) {
          alert(deleteError.message);
          setLoading(false);
          return;
        }
        
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('msg', `Eventos eliminados. ${cascadeResult?.resetMatches || 0} partidos reseteados.`);
        currentUrl.searchParams.set('type', 'success');
        window.location.href = currentUrl.toString();
      } else {
        // Save new events (original flow)
        const formData = new FormData();
        formData.append('partido_id', matchData!.partidoId);
        formData.append('events', JSON.stringify(pendingEvents));
        if (pendingSaveData.finalizar) formData.append('finalizar', 'true');
        
        const { error } = await actions.batchSaveMatchEvents(formData);
        
        if (error) {
          alert(error.message);
          setLoading(false);
        } else {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('msg', `Resultado actualizado. ${cascadeResult?.resetMatches || 0} partidos reseteados.`);
          currentUrl.searchParams.set('type', 'success');
          window.location.href = currentUrl.toString();
        }
      }
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };
  
  const handleCascadeCancel = () => {
    setShowCascadeModal(false);
    setCascadeData(null);
    setPendingSaveData(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !loading && setIsOpen(false)}></div>
      <div className="bg-white rounded-[3rem] w-full max-w-2xl relative shadow-2xl p-10 animate-in fade-in zoom-in duration-200 overflow-hidden">
        
        <button 
          onClick={() => setIsOpen(false)}
          disabled={loading}
          className="absolute top-8 right-8 z-10 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h3 className="text-xl font-black uppercase tracking-tighter mb-8 text-center text-slate-900">Goles y Eventos</h3>

        <div className="h-full max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
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
                
                {/* Penalty Breakdown */}
                {penalesJugados && penalesLocal && penalesVisitante && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mb-2">Penales</p>
                    <div className="flex justify-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-black text-green-700 text-lg">{penalesLocal} - {penalesVisitante}</p>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Events List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historial</h4>
                    {selectedEventIds.length > 0 && (
                        <button onClick={handleBulkDelete} className="text-xs font-black text-red-500 uppercase tracking-widest hover:underline">
                            Eliminar Seleccionados ({selectedEventIds.length})
                        </button>
                    )}
                </div>
                
                {sortedEvents.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {sortedEvents.map((evento) => (
                        <div key={evento.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors shadow-sm ${selectedEventIds.includes(evento.id) ? 'bg-red-50 border-red-200 ring-1 ring-red-200' : (evento.id.startsWith('pending') ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100 hover:border-blue-200')}`}>
                        <div className="flex items-center gap-4">
                            <input 
                                type="checkbox" 
                                checked={selectedEventIds.includes(evento.id)}
                                onChange={() => handleToggleSelect(evento.id)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border ${
                              evento.id.startsWith('pending') 
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-200' 
                                : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
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
                        disabled={isFormDisabled}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                        disabled={!equipoSeleccionado || isFormDisabled}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                        disabled={isFormDisabled}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>
                
                <button 
                    type="submit"
                    disabled={isFormDisabled}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
                >
                    ⚽ Agregar Gol
                </button>
                
                {isFormDisabled && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                    ⚠️ El torneo debe estar activo para agregar eventos. Asigna todos los equipos a partidos en la primera jornada.
                    </p>
                )}
            </form>

            {/* Penalty Shootout Section */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Definición por Penales</h4>
                
                <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
                    <input 
                        type="checkbox" 
                        id="check-penales-jugados"
                        checked={penalesJugados}
                        onChange={(e) => setPenalesJugados(e.target.checked)}
                        disabled={isFormDisabled || (!matchData.esPartidoVuelta && golesLocal !== golesVisitante)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                    <label 
                        htmlFor="check-penales-jugados" 
                        className={`text-sm font-bold text-slate-700 cursor-pointer select-none ${isFormDisabled || (!matchData.esPartidoVuelta && golesLocal !== golesVisitante) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Se definió por penales {!matchData.esPartidoVuelta && golesLocal !== golesVisitante && '(Solo disponible en empate)'}
                    </label>
                </div>
                
                {penalesJugados && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-2 block">{matchData.equipoLocalNombre}</label>
                            <input 
                                type="number"
                                value={penalesLocal}
                                onChange={(e) => setPenalesLocal(e.target.value)}
                                min="0"
                                max="20"
                                placeholder="Penales"
                                disabled={isFormDisabled}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-2 block">{matchData.equipoVisitanteNombre}</label>
                            <input 
                                type="number"
                                value={penalesVisitante}
                                onChange={(e) => setPenalesVisitante(e.target.value)}
                                min="0"
                                max="20"
                                placeholder="Penales"
                                disabled={isFormDisabled}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Save Section - Static below form */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 mt-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Guardar Cambios</h4>
                
                {/* Finalize Checkbox */}
                <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
                    <input 
                        type="checkbox" 
                        id="check-finalizar-events" 
                        disabled={isFormDisabled}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                    />
                    <label 
                        htmlFor="check-finalizar-events" 
                        className={`text-sm font-bold text-slate-700 cursor-pointer select-none ${isFormDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Finalizar Partido
                    </label>
                </div>

                <button
                    onClick={handleSaveChanges}
                    disabled={loading || isFormDisabled}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
                >
                    <span>💾 Guardar Cambios</span>
                    {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                </button>
            </div>


            </div>
        </div>
      </div>
      
      {/* Cascade Warning Modal */}
      {showCascadeModal && cascadeData && (
        <CascadeWarningModal
          isOpen={showCascadeModal}
          affectedMatches={cascadeData.affectedMatches || []}
          totalEvents={cascadeData.totalEvents || 0}
          onConfirm={handleCascadeConfirm}
          onCancel={handleCascadeCancel}
          impactMessage={cascadeData?.impactMessage}
        />
      )}
    </div>
  );
}
