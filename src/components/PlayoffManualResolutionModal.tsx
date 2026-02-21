import React, { useState } from 'react';

interface Team {
  id: string;
  nombre: string;
  logo_url: string | null;
  stats?: {
      pts: number;
      dp: number;
      gf: number;
  }
}

interface TiedGroup {
  groupName: string;
  teams: Team[];
  slotsToFill: number;
}

interface PlayoffManualResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolutions: Map<string, string[]>) => void;
  tiedGroups: TiedGroup[];
}

export default function PlayoffManualResolutionModal({ isOpen, onClose, onConfirm, tiedGroups }: PlayoffManualResolutionModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, Team[]>>({});

  // Initialize state when modal opens or props change
  React.useEffect(() => {
    if (isOpen && tiedGroups.length > 0) {
      const initialResolutions: Record<string, Team[]> = {};
      tiedGroups.forEach(g => {
        initialResolutions[g.groupName] = [...g.teams];
      });
      setResolutions(initialResolutions);
    }
  }, [isOpen, tiedGroups]);

  const moveTeam = (groupName: string, index: number, direction: 'up' | 'down') => {
    const currentList = [...(resolutions[groupName] || [])];
    if (direction === 'up' && index > 0) {
      [currentList[index - 1], currentList[index]] = [currentList[index], currentList[index - 1]];
    } else if (direction === 'down' && index < currentList.length - 1) {
      [currentList[index], currentList[index + 1]] = [currentList[index + 1], currentList[index]];
    }
    setResolutions({ ...resolutions, [groupName]: currentList });
  };

  const handleConfirm = () => {
    const resolutionMap = new Map<string, string[]>();
    Object.entries(resolutions).forEach(([group, teams]) => {
      resolutionMap.set(group, teams.map(t => t.id));
    });
    onConfirm(resolutionMap);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-[2rem] w-full max-w-3xl relative shadow-2xl p-8 animate-in fade-in zoom-in duration-200 overflow-hidden max-h-[90vh] flex flex-col">
        
        <div className="mb-6 text-center">
            <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Desempate Manual Requerido</h3>
            <p className="text-slate-500 font-medium text-sm mt-2">
                El sistema ha detectado un empate absoluto que afecta la clasificación. 
                Por favor, ordena manualmente los equipos arrastrando o usando las flechas.
            </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
            {tiedGroups.map((group) => {
                const groupTeams = resolutions[group.groupName] || group.teams;
                return (
                    <div key={group.groupName} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <div className="flex justify-between items-end mb-4 border-b border-slate-200 pb-2">
                            <h4 className="text-xl font-black text-slate-800">Grupo {group.groupName}</h4>
                            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">
                                {group.slotsToFill} cupo(s) disponible(s) en disputa
                            </span>
                        </div>

                        <div className="space-y-2">
                            {groupTeams.map((team, index) => {
                                const isQualifying = index < group.slotsToFill;
                                return (
                                    <div 
                                        key={team.id} 
                                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                            isQualifying 
                                            ? 'bg-green-50 border-green-500 shadow-sm z-10 scale-[1.01]' 
                                            : 'bg-white border-slate-200 opacity-75'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${
                                                isQualifying ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {index + 1}
                                            </span>
                                            {team.logo_url ? (
                                                <img src={team.logo_url} alt={team.nombre} className="w-8 h-8 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {team.nombre.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">{team.nombre}</span>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">
                                                    PTS: {team.stats?.pts} | DG: {team.stats?.dp} | GF: {team.stats?.gf}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => moveTeam(group.groupName, index, 'up')}
                                                disabled={index === 0}
                                                className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-50 rounded"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
                                            </button>
                                            <button 
                                                onClick={() => moveTeam(group.groupName, index, 'down')}
                                                disabled={index === groupTeams.length - 1}
                                                className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-50 rounded"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="mt-4 flex gap-2 justify-end">
                             <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                <div className="w-3 h-3 bg-green-50 border border-green-500 rounded"></div> Clasifica
                                <div className="w-3 h-3 bg-white border border-slate-200 rounded"></div> Eliminado
                             </div>
                        </div>
                    </div>
                );
            })}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex gap-4">
            <button 
                onClick={onClose}
                className="flex-1 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors uppercase tracking-widest text-xs"
            >
                Cancelar
            </button>
            <button 
                onClick={handleConfirm}
                className="flex-[2] py-4 rounded-xl font-black text-white bg-slate-900 hover:bg-slate-800 shadow-xl transition-all uppercase tracking-widest text-xs"
            >
                Confirmar Clasificación
            </button>
        </div>

      </div>
    </div>
  );
}
