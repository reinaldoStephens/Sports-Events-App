import { useState } from 'react';

interface DeleteCascadeWarningProps {
  isOpen: boolean;
  affectedMatches: Array<{
    match_id: string;
    fase: string;
    local: string;
    visitante: string;
    score_local: number | null;
    score_visitante: number | null;
    estado: string;
    events_count: number;
  }>;
  totalEvents: number;
  impactMessage: string;
  showCascadeOption?: boolean;
  onConfirm: (cascade: boolean) => void;
  onCancel: () => void;
}

export default function DeleteCascadeWarning({
  isOpen,
  affectedMatches,
  totalEvents,
  impactMessage,
  showCascadeOption = false,
  onConfirm,
  onCancel
}: DeleteCascadeWarningProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
        onClick={onCancel}
      ></div>
      
      <div className="bg-white rounded-[3rem] w-full max-w-2xl relative shadow-2xl p-10 animate-in fade-in zoom-in duration-200 overflow-hidden">
        <button 
          onClick={onCancel}
          className="absolute top-8 right-8 z-10 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
              ⚠️ Advertencia de Eliminación
            </h3>
            <p className="text-sm text-slate-600 font-medium mt-1">
              Esta acción afectará otros elementos del torneo
            </p>
          </div>
        </div>

        <div className="h-full max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Impact Message */}
          {impactMessage && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-amber-900 font-bold">
                {impactMessage}
              </p>
            </div>
          )}

          {/* Affected Matches Summary */}
          {affectedMatches.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                Partidos Afectados ({affectedMatches.length})
              </h4>
              
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {affectedMatches.map((match, idx) => (
                  <div 
                    key={match.match_id || idx} 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                        {match.fase}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        match.estado === 'finalizado' 
                          ? 'bg-green-100 text-green-700' 
                          : match.estado === 'en_curso'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {match.estado === 'finalizado' ? 'Finalizado' : match.estado === 'en_curso' ? 'En Curso' : 'Pendiente'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-900">{match.local || 'TBD'}</span>
                      {match.score_local !== null && match.score_visitante !== null && (
                        <span className="font-black text-slate-400 mx-2">
                          {match.score_local} - {match.score_visitante}
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{match.visitante || 'TBD'}</span>
                    </div>
                    
                    {match.events_count > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        {match.events_count} evento(s) registrado(s) • Se eliminarán
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total Impact */}
          {totalEvents > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
              <p className="text-sm text-red-900 font-bold">
                🗑️ Total de eventos a eliminar: <span className="text-lg">{totalEvents}</span>
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-xl transition-all"
          >
            Cancelar
          </button>
          
          {showCascadeOption ? (
             <button
                 onClick={() => onConfirm(true)}
                 className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
             >
                 Eliminar y Reiniciar Playoffs
             </button>
          ) : (
            <button
                onClick={() => onConfirm(false)}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
                ⚠️ Eliminar de Todos Modos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
