// Cargos padrão usados como fallback quando a tabela public.roles
// ainda não existe no banco (antes de rodar cargos_permissions_schema.sql).
// A fonte da verdade, quando existe, é sempre a tabela roles.
export const INITIAL_ROLES = [
  {
    id: 'role_recepcao',
    name: 'Recepcionista',
    permissions: {
      dashboard: { ver: true, edit: false },
      agenda: { ver: true, edit: true },
      pacientes: { ver: true, edit: true },
      anamnese: { ver: true, edit: false },
      servicos: { ver: true, edit: false }
    }
  },
  {
    id: 'role_profissional',
    name: 'Profissional / Atendimento',
    permissions: {
      dashboard: { ver: true, edit: false },
      agenda: { ver: true, edit: true },
      pacientes: { ver: true, edit: true },
      anamnese: { ver: true, edit: true },
      estoque: { ver: true, edit: false }
    }
  },
  {
    id: 'role_financeiro',
    name: 'Financeiro',
    permissions: {
      dashboard: { ver: true, edit: true },
      relatorios: { ver: true, edit: true },
      comissoes: { ver: true, edit: true },
      financeiro: { ver: true, edit: true }
    }
  },
  {
    id: 'role_gerente',
    name: 'Gerente Operacional',
    permissions: {
      dashboard: { ver: true, edit: true },
      agenda: { ver: true, edit: true },
      pacientes: { ver: true, edit: true },
      equipe: { ver: true, edit: true },
      servicos: { ver: true, edit: true },
      estoque: { ver: true, edit: true },
      pacotes: { ver: true, edit: true },
      relatorios: { ver: true, edit: true },
      tarefas: { ver: true, edit: true },
      marketing: { ver: true, edit: true }
    }
  }
];
