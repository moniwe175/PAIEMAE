import { createContext, useContext, useState, useCallback } from 'react';

// ─── MONTH CONFIG ───────────────────────────────────────────────────────────────
// Adjust these values to match the current month dynamically if needed
const CURRENT_DAY = 15;
const TOTAL_DAYS = 30;
const CURRENT_MONTH = 'Junho 2025';

// ─── INITIAL OKR DATA ───────────────────────────────────────────────────────────
// Replace or load from your own data source / API
const initialOkrData = [
  {
    id: 'obj-1',
    objective: 'Aumentar Faturamento Mensal para R$80.000',
    owner: 'Evelyn',
    keyResults: [
      {
        id: 'kr-1-1',
        name: 'Fechar 15 novos pacotes premium',
        target: 15,
        unit: 'pacotes',
        tasks: [
          { id: 't-1', title: 'Ligar para lista de leads quentes', assignee: 'Gabriela', dueDay: 10, column: 'todo' },
          { id: 't-2', title: 'Preparar proposta para Clínica ABC', assignee: 'Evelyn', dueDay: 12, column: 'doing' },
          { id: 't-3', title: 'Follow-up com leads do Instagram', assignee: 'Gabriela', dueDay: 14, column: 'doing' },
          { id: 't-4', title: 'Fechar pacote com Maria Silva', assignee: 'Evelyn', dueDay: 8, column: 'done' },
          { id: 't-5', title: 'Enviar proposta para Studio Bella', assignee: 'Barbara', dueDay: 16, column: 'todo' },
          { id: 't-6', title: 'Negociar upgrade com pacientes atuais', assignee: 'Evelyn', dueDay: 18, column: 'todo' },
        ]
      },
      {
        id: 'kr-1-2',
        name: 'Aumentar ticket médio para R$280',
        target: 280,
        unit: 'R$',
        tasks: [
          { id: 't-7', title: 'Criar combos de serviços premium', assignee: 'Evelyn', dueDay: 8, column: 'done' },
          { id: 't-8', title: 'Treinar equipe em upselling', assignee: 'Barbara', dueDay: 12, column: 'done' },
          { id: 't-9', title: 'Implementar sugestão automática de add-ons', assignee: 'Gabriela', dueDay: 20, column: 'doing' },
          { id: 't-10', title: 'Revisar precificação dos serviços', assignee: 'Evelyn', dueDay: 22, column: 'todo' },
        ]
      },
      {
        id: 'kr-1-3',
        name: 'Reduzir cancelamentos para menos de 5%',
        target: 5,
        unit: '%',
        tasks: [
          { id: 't-11', title: 'Implementar lembrete 24h por WhatsApp', assignee: 'Gabriela', dueDay: 5, column: 'done' },
          { id: 't-12', title: 'Criar política de reagendamento flexível', assignee: 'Evelyn', dueDay: 10, column: 'done' },
          { id: 't-13', title: 'Analisar padrões de cancelamento', assignee: 'Barbara', dueDay: 15, column: 'doing' },
          { id: 't-14', title: 'Ligar para pacientes que cancelaram 2x', assignee: 'Gabriela', dueDay: 20, column: 'todo' },
        ]
      }
    ]
  },
  {
    id: 'obj-2',
    objective: 'Expandir Base de Pacientes em 25%',
    owner: 'Gabriela',
    keyResults: [
      {
        id: 'kr-2-1',
        name: 'Captar 40 novos pacientes via marketing digital',
        target: 40,
        unit: 'pacientes',
        tasks: [
          { id: 't-15', title: 'Lançar campanha de Reels com antes/depois', assignee: 'Gabriela', dueDay: 5, column: 'done' },
          { id: 't-16', title: 'Configurar anúncios no Meta Ads', assignee: 'Gabriela', dueDay: 7, column: 'done' },
          { id: 't-17', title: 'Criar landing page com oferta especial', assignee: 'Barbara', dueDay: 12, column: 'doing' },
          { id: 't-18', title: 'Parceria com influenciadora local', assignee: 'Gabriela', dueDay: 18, column: 'todo' },
          { id: 't-19', title: 'Otimizar Google Meu Negócio', assignee: 'Barbara', dueDay: 20, column: 'todo' },
        ]
      },
      {
        id: 'kr-2-2',
        name: 'Programa de indicação gerar 15 novos pacientes',
        target: 15,
        unit: 'pacientes',
        tasks: [
          { id: 't-20', title: 'Desenhar programa de recompensas', assignee: 'Evelyn', dueDay: 6, column: 'done' },
          { id: 't-21', title: 'Criar material visual do programa', assignee: 'Gabriela', dueDay: 10, column: 'done' },
          { id: 't-22', title: 'Treinar recepção para divulgar programa', assignee: 'Barbara', dueDay: 14, column: 'doing' },
          { id: 't-23', title: 'Enviar SMS para base de pacientes ativos', assignee: 'Gabriela', dueDay: 16, column: 'todo' },
        ]
      }
    ]
  },
  {
    id: 'obj-3',
    objective: 'Elevar Satisfação e Retenção de Pacientes',
    owner: 'Barbara',
    keyResults: [
      {
        id: 'kr-3-1',
        name: 'NPS acima de 85',
        target: 85,
        unit: 'pontos',
        tasks: [
          { id: 't-24', title: 'Implementar pesquisa pós-atendimento', assignee: 'Barbara', dueDay: 5, column: 'done' },
          { id: 't-25', title: 'Tratar detratores em até 24h', assignee: 'Evelyn', dueDay: 15, column: 'doing' },
          { id: 't-26', title: 'Criar ritual de encantamento pós-consulta', assignee: 'Barbara', dueDay: 18, column: 'todo' },
          { id: 't-27', title: 'Reunião semanal de feedback da equipe', assignee: 'Barbara', dueDay: 20, column: 'todo' },
        ]
      },
      {
        id: 'kr-3-2',
        name: 'Taxa de retorno > 70%',
        target: 70,
        unit: '%',
        tasks: [
          { id: 't-28', title: 'Automatizar agendamento de retorno', assignee: 'Gabriela', dueDay: 7, column: 'done' },
          { id: 't-29', title: 'Oferecer desconto para remarcação imediata', assignee: 'Evelyn', dueDay: 10, column: 'done' },
          { id: 't-30', title: 'Criar programa de fidelidade por frequência', assignee: 'Barbara', dueDay: 16, column: 'doing' },
          { id: 't-31', title: 'Ligar para inativos há mais de 45 dias', assignee: 'Gabriela', dueDay: 22, column: 'todo' },
        ]
      }
    ]
  }
];

// ─── HELPERS ────────────────────────────────────────────────────────────────────
let _idCounter = Date.now();
function genId(prefix) {
  return `${prefix}-${(++_idCounter).toString(36)}`;
}

// ─── CONTEXT ────────────────────────────────────────────────────────────────────
const OKRContext = createContext(null);

export function OKRProvider({ children }) {
  const [okrData, setOkrData] = useState(initialOkrData);

  // ── Task Operations ──────────────────────────────────────────
  const moveTask = useCallback((krId, taskId, newColumn) => {
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr => {
        if (kr.id !== krId) return kr;
        return {
          ...kr,
          tasks: kr.tasks.map(t => t.id === taskId ? { ...t, column: newColumn } : t)
        };
      })
    })));
  }, []);

  const addTask = useCallback((krId, taskData) => {
    const newTask = { id: genId('t'), column: 'todo', ...taskData };
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr =>
        kr.id === krId ? { ...kr, tasks: [...kr.tasks, newTask] } : kr
      )
    })));
  }, []);

  const updateTask = useCallback((krId, taskId, updates) => {
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr =>
        kr.id === krId
          ? { ...kr, tasks: kr.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }
          : kr
      )
    })));
  }, []);

  const deleteTask = useCallback((krId, taskId) => {
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr =>
        kr.id === krId
          ? { ...kr, tasks: kr.tasks.filter(t => t.id !== taskId) }
          : kr
      )
    })));
  }, []);

  // ── Key Result Operations ────────────────────────────────────
  const addKeyResult = useCallback((objId, krData) => {
    const newKR = { id: genId('kr'), tasks: [], ...krData };
    setOkrData(prev => prev.map(obj =>
      obj.id === objId
        ? { ...obj, keyResults: [...obj.keyResults, newKR] }
        : obj
    ));
  }, []);

  const updateKeyResult = useCallback((objId, krId, updates) => {
    setOkrData(prev => prev.map(obj =>
      obj.id === objId
        ? {
            ...obj,
            keyResults: obj.keyResults.map(kr =>
              kr.id === krId ? { ...kr, ...updates } : kr
            )
          }
        : obj
    ));
  }, []);

  const deleteKeyResult = useCallback((objId, krId) => {
    setOkrData(prev => prev.map(obj =>
      obj.id === objId
        ? { ...obj, keyResults: obj.keyResults.filter(kr => kr.id !== krId) }
        : obj
    ));
  }, []);

  // ── Objective Operations ───────────────────────────────────────
  const addObjective = useCallback((objData) => {
    const newObj = { id: genId('obj'), keyResults: [], ...objData };
    setOkrData(prev => [...prev, newObj]);
  }, []);

  const updateObjective = useCallback((objId, updates) => {
    setOkrData(prev => prev.map(obj =>
      obj.id === objId ? { ...obj, ...updates } : obj
    ));
  }, []);

  const deleteObjective = useCallback((objId) => {
    setOkrData(prev => prev.filter(obj => obj.id !== objId));
  }, []);

  const value = {
    okrData,
    moveTask,
    addTask,
    updateTask,
    deleteTask,
    addKeyResult,
    updateKeyResult,
    deleteKeyResult,
    addObjective,
    updateObjective,
    deleteObjective,
    currentDay: CURRENT_DAY,
    totalDays: TOTAL_DAYS,
    currentMonth: CURRENT_MONTH,
  };

  return (
    <OKRContext.Provider value={value}>
      {children}
    </OKRContext.Provider>
  );
}

export function useOKR() {
  const context = useContext(OKRContext);
  if (!context) {
    throw new Error('useOKR must be used within an OKRProvider');
  }
  return context;
}
