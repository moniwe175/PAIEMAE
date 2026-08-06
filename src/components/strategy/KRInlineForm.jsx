import { useState } from 'react';
import { Save } from 'lucide-react';

export default function KRInlineForm({ onSave, onCancel, initialData }) {
  const [name, setName] = useState(initialData?.titulo || '');
  const [currentValue, setCurrentValue] = useState(initialData?.valor_atual ?? '');
  const [targetValue, setTargetValue] = useState(initialData?.valor_meta ?? '');
  const [unit, setUnit] = useState(initialData?.metrica || '');

  const canSave = name.trim() && targetValue !== '';

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      titulo: name.trim(),
      valor_atual: Number(currentValue) || 0,
      valor_meta: Number(targetValue) || 0,
      metrica: unit.trim() || 'R$',
    });
  };

  return (
    <div className="flex flex-row items-end gap-4 rounded-lg border border-stone-200 bg-white p-4">
      {/* NOME DO KR */}
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Nome do KR
        </label>
        <input
          type="text"
          placeholder="ex: Aumentar Ticket Médio"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-[#B3857A] focus:ring-1 focus:ring-[#B3857A]/30"
        />
      </div>

      {/* VALOR ATUAL */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Valor Atual
        </label>
        <input
          type="number"
          placeholder="0"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="w-24 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-[#B3857A] focus:ring-1 focus:ring-[#B3857A]/30"
        />
      </div>

      {/* VALOR META */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Valor Meta
        </label>
        <input
          type="number"
          placeholder="100"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          className="w-24 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-[#B3857A] focus:ring-1 focus:ring-[#B3857A]/30"
        />
      </div>

      {/* UNIDADE */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Unidade
        </label>
        <input
          type="text"
          placeholder="R$"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-20 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-[#B3857A] focus:ring-1 focus:ring-[#B3857A]/30"
        />
      </div>

      {/* BOTÕES */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 rounded-md bg-[#B3857A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A0776D] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Salvar
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-stone-500 transition-colors hover:text-stone-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
