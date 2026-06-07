// Financial mock data structures
// NOTE: Transactions and expenses start EMPTY intentionally.
// Real data populates when spreadsheet is connected via Integracoes tab.

export interface Transaction {
  id: string | number;
  hora: string;
  cliente: string;
  procedimento: string;
  total: number;
  clinica: number;
  profissional: number;
  pagamento: 'Pix' | 'Crédito' | 'Débito' | 'Dinheiro' | 'Boleto' | 'Outro';
  status: 'paid' | 'pending' | 'cancelled';
  origem: 'planilha' | 'manual';
  data: string; // DD/MM/YYYY
  profissionalNome?: string;
  tipo: 'receita' | 'despesa';
}

export interface Expense {
  id: string | number;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  metodoPagamento: string;
  origem: 'planilha' | 'manual';
}

export interface CashierState {
  status: 'aberto' | 'fechado';
  saldo: number;
  horaAbertura: string | null;
  dataAbertura: string | null; // DD/MM/YYYY
  sangrias: Sangria[];
}

export interface Sangria {
  id: string;
  valor: number;
  motivo: string;
  hora: string;
  data: string;
}

export interface SplitConfig {
  profissional: string;
  percentual: number;
}

export interface PaymentMethod {
  id: string;
  nome: string;
  icone: string;
  ativo: boolean;
}

// Default cashier state (fechado)
export const defaultCashier: CashierState = {
  status: 'fechado',
  saldo: 0,
  horaAbertura: null,
  dataAbertura: null,
  sangrias: [],
};

// Default split configuration
export const defaultSplitConfig: SplitConfig[] = [
  { profissional: 'Dra. Evelyn Souza', percentual: 50 },
  { profissional: 'Dra. Carla Mendes', percentual: 45 },
  { profissional: 'Dra. Marina Costa', percentual: 40 },
];

// Payment methods accepted
export const paymentMethods: PaymentMethod[] = [
  { id: 'pix', nome: 'Pix', icone: 'pix', ativo: true },
  { id: 'credito', nome: 'Crédito', icone: 'card', ativo: true },
  { id: 'debito', nome: 'Débito', icone: 'card', ativo: true },
  { id: 'dinheiro', nome: 'Dinheiro', icone: 'cash', ativo: true },
  { id: 'boleto', nome: 'Boleto', icone: 'file', ativo: false },
];

// Helper: calculate split
export function calcularSplit(total: number, percentualProf: number): { clinica: number; profissional: number } {
  const prof = Math.round(total * (percentualProf / 100));
  const cli = total - prof;
  return { clinica: cli, profissional: prof };
}

// Helper: format currency
export function fmtCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper: get today's date in pt-BR
export function hoje(): string {
  return new Date().toLocaleDateString('pt-BR');
}
