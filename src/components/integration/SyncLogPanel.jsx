import React from 'react';

const SyncLogPanel = () => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Log de Sincronização</h3>
      </div>
      <div className="p-4 h-64 overflow-y-auto font-mono text-xs text-slate-600 space-y-1">
        <p>[14:42:00] Iniciando monitoramento...</p>
        <p className="text-slate-400">Nenhum log disponível no momento.</p>
      </div>
    </div>
  );
};

export default SyncLogPanel;
