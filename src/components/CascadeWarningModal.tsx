import React from 'react';

interface AffectedMatch {
  match_id: string;
  fase: string;
  local: string;
  visitante: string;
  score_local: number | null;
  score_visitante: number | null;
  estado: string;
  events_count: number;
}

interface CascadeWarningModalProps {
  isOpen: boolean;
  affectedMatches: AffectedMatch[];
  totalEvents: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CascadeWarningModal({
  isOpen,
  affectedMatches,
  totalEvents,
  onConfirm,
  onCancel
}: CascadeWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-2xl font-black uppercase tracking-tight">⚠️ Advertencia de Cambio en Cascada</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <p className="text-sm font-bold text-red-900 leading-relaxed">
                Cambiar el resultado de este partido <span className="underline">eliminará automáticamente</span> los datos de los partidos siguientes en los que participaba el equipo que está siendo reemplazado.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Impacto de la Operación:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-2xl font-black text-red-600">{affectedMatches.length}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Partidos Afectados</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-2xl font-black text-orange-600">{totalEvents}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Eventos a Eliminar</div>
                </div>
              </div>
            </div>

            {affectedMatches.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Partidos que Serán Reseteados:</h4>
                <div className="space-y-2">
                  {affectedMatches.map((match) => (
                    <div key={match.match_id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">
                          {match.fase}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {match.events_count} eventos
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-700">{match.local || 'TBD'}</span>
                        <div className="flex items-center gap-2">
                          {match.score_local !== null && match.score_visitante !== null ? (
                            <>
                              <span className="font-black text-slate-900">{match.score_local}</span>
                              <span className="text-slate-300">-</span>
                              <span className="font-black text-slate-900">{match.score_visitante}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 text-xs">Sin resultado</span>
                          )}
                        </div>
                        <span className="font-bold text-slate-700">{match.visitante || 'TBD'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs text-yellow-900 font-bold">
                ⚠️ Esta operación <span className="underline">no se puede deshacer</span>. Los marcadores y eventos de los partidos afectados serán eliminados permanentemente.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 bg-white border-2 border-slate-300 text-slate-700 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:from-red-600 hover:to-orange-600 transition-all shadow-lg"
          >
            Confirmar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
