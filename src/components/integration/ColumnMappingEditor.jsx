import React from 'react';

const ColumnMappingEditor = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Mapeamento de Colunas</h3>
      <p className="text-sm text-slate-500 mb-6">Configure a relação entre os campos do sistema e as colunas da sua planilha.</p>
      
      <div className="space-y-4">
        <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-lg text-slate-400 italic">
          Configuração de mapeamento pendente
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingEditor;
