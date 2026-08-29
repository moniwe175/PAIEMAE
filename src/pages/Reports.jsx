import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Calendar, DollarSign,
  FileSpreadsheet, Wallet, Zap, Loader2, Tag, Percent, Award,
  SlidersHorizontal, Edit3, Plus, Trash2, Check, X, Layers, Boxes,
  CircleDollarSign, ArrowUpRight, ArrowDownRight, Package
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { todayBRT, fetchInventory } from '../services/supabaseService';
import { useServicos } from '../lib/servicos';
import { useSync } from '../contexts/SyncContext';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';

// ─── Helpers ──────────────────────────────────────────────────
/** Brazilian currency format: R$ 1.234,56 */
const formatBRL = (val) =>
  `R$ ${(Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Convert YYYY-MM-DD → DD/MM/YYYY */
const formatDateBR = (dateStr) => {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/** Safely read a numeric field from a cashier record */
const numField = (rec, ...keys) => {
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') {
      const n = Number(rec[k]);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
};

// ─── Default Insumos Composition for Procedures ───────────────
const DEFAULT_SERVICE_INSUMOS = {
  'Botox Facial': [
    { insumoNome: 'Toxina Botulínica 100U', qtd: 0.5, unidade: 'frasco', custoUnitario: 320 },
    { insumoNome: 'Seringa c/ Agulha 1ml', qtd: 2, unidade: 'unidade', custoUnitario: 3.5 },
    { insumoNome: 'Anestésico Tópico', qtd: 1, unidade: 'dose', custoUnitario: 8 },
    { insumoNome: 'Kit Descartável / Gaze', qtd: 1, unidade: 'kit', custoUnitario: 3 },
  ],
  'Preenchimento Labial': [
    { insumoNome: 'Ácido Hialurônico 1ml', qtd: 1, unidade: 'seringa', custoUnitario: 290 },
    { insumoNome: 'Microcânula 22G', qtd: 1, unidade: 'unidade', custoUnitario: 18 },
    { insumoNome: 'Anestésico Odontológico', qtd: 1, unidade: 'tubete', custoUnitario: 9 },
    { insumoNome: 'Gaze Estéril e Clorexidina', qtd: 1, unidade: 'kit', custoUnitario: 4 },
  ],
  'Bioestimulador': [
    { insumoNome: 'Bioestimulador de Colágeno', qtd: 1, unidade: 'frasco', custoUnitario: 520 },
    { insumoNome: 'Cânula e Seringa 3ml', qtd: 1, unidade: 'kit', custoUnitario: 22 },
    { insumoNome: 'Água para Injeção 10ml', qtd: 1, unidade: 'ampola', custoUnitario: 4 },
  ],
  'Limpeza de Pele': [
    { insumoNome: 'Sabonete Facial e Tônico', qtd: 1, unidade: 'dose', custoUnitario: 4 },
    { insumoNome: 'Creme Emoliente', qtd: 1, unidade: 'dose', custoUnitario: 6 },
    { insumoNome: 'Máscara Calmante / Argila', qtd: 1, unidade: 'dose', custoUnitario: 8 },
    { insumoNome: 'Kit Algodão e Gaze', qtd: 1, unidade: 'kit', custoUnitario: 3 },
  ],
  'Peeling Químico': [
    { insumoNome: 'Ácido Glicólico / Salicílico', qtd: 1, unidade: 'dose', custoUnitario: 19 },
    { insumoNome: 'Solução Neutralizante', qtd: 1, unidade: 'dose', custoUnitario: 5 },
    { insumoNome: 'Protetor Solar e Finalizador', qtd: 1, unidade: 'dose', custoUnitario: 4 },
  ],
  'Drenagem Linfática': [
    { insumoNome: 'Creme Hidratante Corporal', qtd: 1, unidade: 'dose', custoUnitario: 6 },
    { insumoNome: 'Lençol Descartável TNT', qtd: 1, unidade: 'unidade', custoUnitario: 2.5 },
  ],
  'Design de Sobrancelha': [
    { insumoNome: 'Linha / Henna para Sobrancelhas', qtd: 1, unidade: 'dose', custoUnitario: 4.5 },
    { insumoNome: 'Algodão e Adstringente', qtd: 1, unidade: 'kit', custoUnitario: 2 },
  ],
  'Harmonização Facial': [
    { insumoNome: 'Ácido Hialurônico Alta Densidade', qtd: 2, unidade: 'seringa', custoUnitario: 310 },
    { insumoNome: 'Cânula 22G', qtd: 2, unidade: 'unidade', custoUnitario: 18 },
    { insumoNome: 'Anestésico e Descartáveis', qtd: 1, unidade: 'kit', custoUnitario: 25 },
  ],
};

export default function Reports() {
  const { transactions, comissoes, cashierHistory } = useSync();
  const { servicos: catalogoServicos } = useServicos();

  // ─── State ──────────────────────────────────────────────────
  const [periodo, setPeriodo] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [serviceRankingSort, setServiceRankingSort] = useState('valor'); // 'valor' | 'qtd'

  // Inventory & Supplies for Margem de Contribuição
  const [inventoryItems, setInventoryItems] = useState([]);
  const [serviceInsumosMap, setServiceInsumosMap] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_servico_insumos_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SERVICE_INSUMOS;
  });

  // Modal para vincular insumos ao serviço
  const [modalInsumos, setModalInsumos] = useState({ open: false, serviceName: '', insumos: [] });

  // KPI state from sheet_transactions
  const [sheetKpis, setSheetKpis] = useState({
    faturamento: 0,
    faturamentoAnterior: 0,
    totalSessoes: 0,
    ticketMedio: 0,
    totalPix: 0,
    totalCartao: 0,
    totalCredito: 0,
    totalDebito: 0,
    totalDinheiro: 0,
    novosPacientes: 0,
    loading: true,
  });
  const [sheetTxData, setSheetTxData] = useState([]);
  const [sangriasList, setSangriasList] = useState([]);
  const [despesasSheetList, setDespesasSheetList] = useState([]);

  // Load Inventory for Supplies Linking
  useEffect(() => {
    async function loadStock() {
      const { data } = await fetchInventory();
      if (data) setInventoryItems(data);
    }
    loadStock();
  }, []);

  // ─── Date range computation ─────────────────────────────────
  const { startDateStr, endDateStr, prevStartDateStr, prevEndDateStr, daysCount } = useMemo(() => {
    const fmtBRT = (d) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

    const today = new Date();
    let end = new Date(today);
    end.setHours(23, 59, 59, 999);
    let start = new Date(today);
    start.setHours(0, 0, 0, 0);

    let prevStart = new Date(today);
    prevStart.setHours(0, 0, 0, 0);
    let prevEnd = new Date(today);
    prevEnd.setHours(23, 59, 59, 999);
    let numDays = 30;

    if (periodo === '7d') {
      numDays = 7;
      start.setDate(today.getDate() - 6);
      prevEnd.setDate(today.getDate() - 7);
      prevStart.setDate(today.getDate() - 13);
    } else if (periodo === '30d') {
      numDays = 30;
      start.setDate(today.getDate() - 29);
      prevEnd.setDate(today.getDate() - 30);
      prevStart.setDate(today.getDate() - 59);
    } else if (periodo === '90d') {
      numDays = 90;
      start.setDate(today.getDate() - 89);
      prevEnd.setDate(today.getDate() - 90);
      prevStart.setDate(today.getDate() - 179);
    } else if (periodo === '6m') {
      numDays = 180;
      start.setDate(today.getDate() - 179);
      prevEnd.setDate(today.getDate() - 180);
      prevStart.setDate(today.getDate() - 359);
    } else if (periodo === 'ano') {
      const currentYear = today.getFullYear();
      start = new Date(currentYear, 0, 1, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      numDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      prevStart = new Date(currentYear - 1, 0, 1, 0, 0, 0);
      prevEnd = new Date(currentYear - 1, today.getMonth(), today.getDate(), 23, 59, 59, 999);
    } else if (periodo === 'custom') {
      if (customStart) start = new Date(customStart + 'T00:00:00');
      if (customEnd) end = new Date(customEnd + 'T23:59:59');

      numDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
      prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - numDays + 1);
      prevStart.setHours(0, 0, 0, 0);
    }

    return {
      startDateStr: fmtBRT(start),
      endDateStr: fmtBRT(end),
      prevStartDateStr: fmtBRT(prevStart),
      prevEndDateStr: fmtBRT(prevEnd),
      daysCount: numDays,
    };
  }, [periodo, customStart, customEnd]);

  // ─── Fetch KPIs from sheet_transactions and sangrias ────────
  useEffect(() => {
    let cancelled = false;

    async function fetchSheetKpis() {
      setSheetKpis((prev) => ({ ...prev, loading: true }));
      try {
        const [txRes, prevTxRes, sangriasRes, despesasRes] = await Promise.all([
          supabase
            .from('sheet_transactions')
            .select(
              'gross, date_ref, pix, credito, debito, dinheiro, client, procedure, professional, payment_method, commission_value'
            )
            .eq('row_type', 'receita')
            .eq('is_metadata', false)
            .is('deleted_at', null)
            .gte('date_ref', startDateStr)
            .lte('date_ref', endDateStr)
            .order('date_ref', { ascending: false }),
          supabase
            .from('sheet_transactions')
            .select('gross')
            .eq('row_type', 'receita')
            .eq('is_metadata', false)
            .is('deleted_at', null)
            .gte('date_ref', prevStartDateStr)
            .lte('date_ref', prevEndDateStr),
          supabase
            .from('cashier_sangrias')
            .select('valor, cashier_date, motivo')
            .gte('cashier_date', startDateStr)
            .lte('cashier_date', endDateStr),
          supabase
            .from('sheet_transactions')
            .select('gross, date_ref, dinheiro, row_type, payment_method')
            .neq('row_type', 'receita')
            .eq('is_metadata', false)
            .is('deleted_at', null)
            .gte('date_ref', startDateStr)
            .lte('date_ref', endDateStr),
        ]);

        if (txRes.error) throw txRes.error;
        if (cancelled) return;

        const rows = txRes.data || [];
        const prevRows = prevTxRes?.data || [];
        const sangrias = sangriasRes?.data || [];
        const despesas = despesasRes?.data || [];

        const faturamento = rows.reduce((sum, t) => sum + (parseFloat(t.gross) || 0), 0);
        const faturamentoAnterior = prevRows.reduce((sum, t) => sum + (parseFloat(t.gross) || 0), 0);
        const totalSessoes = rows.length;
        const ticketMedio = totalSessoes > 0 ? faturamento / totalSessoes : 0;
        const totalPix = rows.reduce((sum, t) => sum + (parseFloat(t.pix) || 0), 0);
        const totalCredito = rows.reduce((sum, t) => sum + (parseFloat(t.credito) || 0), 0);
        const totalDebito = rows.reduce((sum, t) => sum + (parseFloat(t.debito) || 0), 0);
        const totalCartao = totalCredito + totalDebito;
        const totalDinheiro = rows.reduce((sum, t) => sum + (parseFloat(t.dinheiro) || 0), 0);
        const novosPacientes = new Set(rows.map((t) => t.client).filter(Boolean)).size;

        setSheetKpis({
          faturamento,
          faturamentoAnterior,
          totalSessoes,
          ticketMedio,
          totalPix,
          totalCartao,
          totalCredito,
          totalDebito,
          totalDinheiro,
          novosPacientes,
          loading: false,
        });
        setSheetTxData(rows);
        setSangriasList(sangrias);
        setDespesasSheetList(despesas);
      } catch (e) {
        if (!cancelled) {
          console.warn('[Reports] Erro ao buscar KPIs da planilha:', e?.message || e);
          setSheetKpis((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchSheetKpis();
    return () => {
      cancelled = true;
    };
  }, [startDateStr, endDateStr, prevStartDateStr, prevEndDateStr]);

  // ─── Totais de pix/cartão/dinheiro/sangria por dia ───────────
  const sheetByDate = useMemo(() => {
    const map = {};
    (sheetTxData || []).forEach((t) => {
      const d = t.date_ref;
      if (!d) return;
      if (!map[d]) map[d] = { pix: 0, credito: 0, debito: 0, dinheiro: 0, sangria: 0 };
      map[d].pix += parseFloat(t.pix) || 0;
      map[d].credito += parseFloat(t.credito) || 0;
      map[d].debito += parseFloat(t.debito) || 0;
      map[d].dinheiro += parseFloat(t.dinheiro) || 0;
    });
    (sangriasList || []).forEach((s) => {
      const d = s.cashier_date;
      if (!d) return;
      if (!map[d]) map[d] = { pix: 0, credito: 0, debito: 0, dinheiro: 0, sangria: 0 };
      map[d].sangria += parseFloat(s.valor) || 0;
    });
    (despesasSheetList || []).forEach((e) => {
      const d = e.date_ref;
      if (!d) return;
      if (!map[d]) map[d] = { pix: 0, credito: 0, debito: 0, dinheiro: 0, sangria: 0 };
      map[d].sangria += parseFloat(e.dinheiro || e.gross) || 0;
    });
    return map;
  }, [sheetTxData, sangriasList, despesasSheetList]);

  // ─── Revenue chart ──────────────────────────────────────────
  const faturamentoChart = useMemo(() => {
    const daily = daysCount <= 92;

    if (daily) {
      const map = new Map();
      const cur = new Date(startDateStr + 'T12:00:00Z');
      const end = new Date(endDateStr + 'T12:00:00Z');
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        map.set(key, { label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, valor: 0 });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      sheetTxData.forEach((t) => {
        const entry = map.get(t.date_ref);
        if (entry) entry.valor += parseFloat(t.gross) || 0;
      });
      return { daily, data: [...map.values()] };
    }

    const months = {};
    sheetTxData.forEach((t) => {
      const dr = t.date_ref || '';
      const parts = dr.split('-');
      if (parts.length !== 3) return;
      const key = `${parts[1]}/${parts[0]}`;
      if (!months[key]) months[key] = { label: key, valor: 0 };
      months[key].valor += parseFloat(t.gross) || 0;
    });
    const data = Object.values(months).sort((a, b) => {
      const [am, ay] = a.label.split('/').map(Number);
      const [bm, by] = b.label.split('/').map(Number);
      return ay * 12 + am - (by * 12 + bm);
    });
    return { daily, data };
  }, [sheetTxData, startDateStr, endDateStr, daysCount]);

  // ─── 2. Mix de Receita por Forma de Pagamento ────────────────
  const { pagamentoData, totalPagamentos, pagamentoStats } = useMemo(() => {
    const pix = sheetKpis.totalPix || 0;
    const credito = sheetKpis.totalCredito || 0;
    const debito = sheetKpis.totalDebito || 0;
    const dinheiro = sheetKpis.totalDinheiro || 0;
    const total = pix + credito + debito + dinheiro;

    const data = [
      { name: 'Pix', value: pix, color: '#10B981', bg: '#ECFDF5' },
      { name: 'Crédito', value: credito, color: '#6366F1', bg: '#EEF2FF' },
      { name: 'Débito', value: debito, color: '#8B5CF6', bg: '#F3E8FF' },
      { name: 'Dinheiro', value: dinheiro, color: '#F59E0B', bg: '#FEF3C7' },
    ].filter((d) => d.value > 0);

    const stats = [
      { name: 'Pix', value: pix, pct: total > 0 ? (pix / total) * 100 : 0, color: '#10B981', bg: '#ECFDF5' },
      { name: 'Cartão de Crédito', value: credito, pct: total > 0 ? (credito / total) * 100 : 0, color: '#6366F1', bg: '#EEF2FF' },
      { name: 'Cartão de Débito', value: debito, pct: total > 0 ? (debito / total) * 100 : 0, color: '#8B5CF6', bg: '#F3E8FF' },
      { name: 'Dinheiro em Espécie', value: dinheiro, pct: total > 0 ? (dinheiro / total) * 100 : 0, color: '#F59E0B', bg: '#FEF3C7' },
    ];

    return { pagamentoData: data, totalPagamentos: total, pagamentoStats: stats };
  }, [sheetKpis]);

  // ─── 3. Ranking Serviços Mais Vendidos ───────────────────────
  const { servicosRankingList, topRankingChart } = useMemo(() => {
    const services = {};
    const totalFaturamento = sheetKpis.faturamento || 0;

    sheetTxData.forEach((t) => {
      const name = (t.procedure || 'Sem procedimento').trim();
      if (!services[name]) services[name] = { nome: name, qtd: 0, valor: 0 };
      services[name].qtd++;
      services[name].valor += parseFloat(t.gross) || 0;
    });

    const list = Object.values(services).map((s) => ({
      ...s,
      ticketMedio: s.qtd > 0 ? s.valor / s.qtd : 0,
      pct: totalFaturamento > 0 ? (s.valor / totalFaturamento) * 100 : 0,
    }));

    if (serviceRankingSort === 'qtd') {
      list.sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
    } else {
      list.sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);
    }

    const chart = list.slice(0, 7).map((s) => ({
      nome: s.nome.length > 22 ? s.nome.substring(0, 20) + '...' : s.nome,
      fullName: s.nome,
      qtd: s.qtd,
      valor: s.valor,
    }));

    return { servicosRankingList: list, topRankingChart: chart };
  }, [sheetTxData, sheetKpis.faturamento, serviceRankingSort]);

  // ─── 4. Margem de Contribuição por Serviço ───────────────────
  const { margemServicosList, resumoMargens } = useMemo(() => {
    let totalReceitaInsumos = 0;
    let totalCustoInsumos = 0;

    // Constrói lista combinando serviços do período com o catálogo
    const map = {};

    sheetTxData.forEach((t) => {
      const name = (t.procedure || 'Sem procedimento').trim();
      if (!map[name]) {
        map[name] = {
          nome: name,
          sessoes: 0,
          faturamento: 0,
        };
      }
      map[name].sessoes++;
      map[name].faturamento += parseFloat(t.gross) || 0;
    });

    // Adiciona serviços cadastrados que podem não ter tido vendas no período
    (catalogoServicos || []).forEach((cs) => {
      if (!map[cs.nome]) {
        map[cs.nome] = {
          nome: cs.nome,
          sessoes: 0,
          faturamento: 0,
          precoCatalogo: cs.preco || 0,
        };
      }
    });

    const list = Object.values(map).map((s) => {
      // Preço médio cobrado por sessão
      const precoMedio = s.sessoes > 0 ? s.faturamento / s.sessoes : (s.precoCatalogo || 0);

      // Insumos vinculados
      const insumos = serviceInsumosMap[s.nome] || [];
      const custoInsumos = insumos.reduce((sum, item) => sum + (Number(item.qtd) || 0) * (Number(item.custoUnitario) || 0), 0);

      const margemReais = Math.max(0, precoMedio - custoInsumos);
      const margemPct = precoMedio > 0 ? (margemReais / precoMedio) * 100 : 0;
      const lucroTotalNoPeriodo = s.sessoes > 0 ? margemReais * s.sessoes : 0;
      const custoTotalNoPeriodo = s.sessoes > 0 ? custoInsumos * s.sessoes : 0;

      totalReceitaInsumos += s.faturamento;
      totalCustoInsumos += custoTotalNoPeriodo;

      return {
        ...s,
        precoMedio,
        insumos,
        custoInsumos,
        margemReais,
        margemPct,
        lucroTotalNoPeriodo,
        custoTotalNoPeriodo,
      };
    });

    list.sort((a, b) => b.faturamento - a.faturamento || b.sessoes - a.sessoes);

    const margemMediaGeral = totalReceitaInsumos > 0
      ? ((totalReceitaInsumos - totalCustoInsumos) / totalReceitaInsumos) * 100
      : 0;

    const lucroBrutoTotal = totalReceitaInsumos - totalCustoInsumos;

    return {
      margemServicosList: list,
      resumoMargens: {
        totalReceita: totalReceitaInsumos,
        totalCusto: totalCustoInsumos,
        lucroBrutoTotal,
        margemMediaGeral,
      },
    };
  }, [sheetTxData, catalogoServicos, serviceInsumosMap]);

  // Handlers para Vincular Insumos
  const handleOpenModalInsumos = (serviceName) => {
    const current = serviceInsumosMap[serviceName] || [];
    setModalInsumos({
      open: true,
      serviceName,
      insumos: JSON.parse(JSON.stringify(current)),
    });
  };

  const handleAddInsumoRow = () => {
    setModalInsumos((prev) => ({
      ...prev,
      insumos: [
        ...prev.insumos,
        { insumoNome: '', qtd: 1, unidade: 'unidade', custoUnitario: 0 },
      ],
    }));
  };

  const handleUpdateInsumoRow = (idx, field, value) => {
    setModalInsumos((prev) => {
      const updated = [...prev.insumos];
      updated[idx] = { ...updated[idx], [field]: value };
      // Se selecionou do estoque, preenche unidade e custo automaticamente
      if (field === 'insumoNome') {
        const found = inventoryItems.find((inv) => inv.nome === value);
        if (found) {
          updated[idx].unidade = found.unidade || 'unidade';
          updated[idx].custoUnitario = Number(found.preco) || 0;
        }
      }
      return { ...prev, insumos: updated };
    });
  };

  const handleRemoveInsumoRow = (idx) => {
    setModalInsumos((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveModalInsumos = () => {
    const cleanInsumos = modalInsumos.insumos.filter((i) => i.insumoNome && Number(i.qtd) > 0);
    const updatedMap = {
      ...serviceInsumosMap,
      [modalInsumos.serviceName]: cleanInsumos,
    };
    setServiceInsumosMap(updatedMap);
    localStorage.setItem('erp_servico_insumos_v1', JSON.stringify(updatedMap));
    setModalInsumos({ open: false, serviceName: '', insumos: [] });
  };

  // ─── Professional ranking (sheet_transactions + comissoes) ──
  const profRanking = useMemo(() => {
    const profs = {};
    sheetTxData.forEach((t) => {
      const name = (t.professional || 'Sem profissional').trim();
      if (!profs[name]) profs[name] = { nome: name, comissaoTotal: 0, sessoes: 0 };
      profs[name].comissaoTotal += parseFloat(t.commission_value) || 0;
      profs[name].sessoes++;
    });
    comissoes.forEach((c) => {
      const name = c.prof || c.profissional || '';
      if (!name) return;
      if (!profs[name]) profs[name] = { nome: name, comissaoTotal: 0, sessoes: 0 };
      profs[name].comissaoTotal += c.valorComissao || 0;
      profs[name].sessoes++;
    });
    return Object.values(profs)
      .sort((a, b) => b.comissaoTotal - a.comissaoTotal)
      .slice(0, 8);
  }, [sheetTxData, comissoes]);

  // ─── Filtered cashier history by date range ─────────────────
  const filteredCashierHistory = useMemo(() => {
    if (!cashierHistory || cashierHistory.length === 0) return [];
    return cashierHistory.filter((c) => {
      const d = c.date || '';
      return d >= startDateStr && d <= endDateStr;
    });
  }, [cashierHistory, startDateStr, endDateStr]);

  // Synced count from legacy transactions (for badge compat)
  const syncedCount = useMemo(
    () => transactions.filter((t) => t.origem === 'planilha').length,
    [transactions]
  );

  // ─── 5. Crescimento de Faturamento Real ─────────────────────
  const growthCardData = useMemo(() => {
    const atual = sheetKpis.faturamento || 0;
    const anterior = sheetKpis.faturamentoAnterior || 0;

    if (atual === 0 && anterior === 0) {
      return {
        val: 'Sem dados',
        sub: 'nenhuma receita registrada no período',
        cor: 'var(--text-muted)',
        icon: TrendingUp,
        bgIcon: 'rgba(107, 114, 128, 0.1)',
      };
    }

    if (anterior === 0) {
      return {
        val: '+100%',
        sub: `1º período registrado (${formatBRL(atual)})`,
        cor: 'var(--success)',
        icon: TrendingUp,
        bgIcon: 'var(--success-bg)',
      };
    }

    const pct = ((atual - anterior) / anterior) * 100;
    const sinal = pct > 0 ? '+' : '';
    const formatted = `${sinal}${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

    if (pct > 0) {
      return {
        val: formatted,
        sub: `vs ${formatBRL(anterior)} no período ant.`,
        cor: 'var(--success)',
        icon: TrendingUp,
        bgIcon: 'var(--success-bg)',
      };
    }
    if (pct < 0) {
      return {
        val: formatted,
        sub: `vs ${formatBRL(anterior)} no período ant.`,
        cor: 'var(--danger)',
        icon: TrendingDown,
        bgIcon: 'rgba(239, 68, 68, 0.12)',
      };
    }
    return {
      val: '0.0%',
      sub: `igual ao período anterior (${formatBRL(anterior)})`,
      cor: 'var(--text-muted)',
      icon: TrendingUp,
      bgIcon: 'rgba(107, 114, 128, 0.1)',
    };
  }, [sheetKpis.faturamento, sheetKpis.faturamentoAnterior]);

  // Ticket Médio por Cliente
  const ticketMedioPorCliente = useMemo(() => {
    if (!sheetKpis.novosPacientes || sheetKpis.novosPacientes === 0) return 0;
    return (sheetKpis.faturamento || 0) / sheetKpis.novosPacientes;
  }, [sheetKpis.faturamento, sheetKpis.novosPacientes]);

  // ─── Period tabs ────────────────────────────────────────────
  const periodTabs = [
    { k: '7d', l: '7 dias' },
    { k: '30d', l: '30 dias' },
    { k: '90d', l: '90 dias' },
    { k: 'ano', l: 'Ano' },
    { k: 'custom', l: 'Personalizado' },
  ];

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div className="page-header-label">
            <BarChart3 />
            RELATÓRIOS E INTELIGÊNCIA
          </div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise aprofundada de receitas, margens e procedimentos da clínica</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SheetSyncStatus compact />
          <div className="tabs">
            {periodTabs.map(({ k, l }) => (
              <button
                key={k}
                className={`tab-item${periodo === k ? ' active' : ''}`}
                onClick={() => setPeriodo(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date range inputs */}
      {periodo === 'custom' && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <label
            style={{
              fontSize: 13,
              color: 'var(--text-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Calendar style={{ width: 14, height: 14 }} /> De:
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="search-input"
              style={{ width: 'auto', paddingLeft: 10 }}
            />
          </label>
          <label
            style={{
              fontSize: 13,
              color: 'var(--text-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Até:
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="search-input"
              style={{ width: 'auto', paddingLeft: 10 }}
            />
          </label>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ({daysCount} dia{daysCount !== 1 ? 's' : ''} selecionado{daysCount !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* ─── 1. KPI Cards (Faturamento, Sessões, Ticket Médio, Crescimento, Médio Diário) ─── */}
      <div className="grid-5 section-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {sheetKpis.loading ? (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              color: 'var(--text-muted)',
            }}
          >
            <Loader2
              style={{
                width: 20,
                height: 20,
                marginRight: 8,
                animation: 'spin 1s linear infinite',
              }}
            />
            Carregando indicadores financeiros...
          </div>
        ) : (
          <>
            {/* Faturamento Total */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-card-icon" style={{ background: 'var(--success-bg)', marginBottom: 8 }}>
                  <DollarSign style={{ color: 'var(--success)' }} />
                </div>
                {syncedCount > 0 && (
                  <span className="stat-badge up">
                    <FileSpreadsheet style={{ width: 10, height: 10 }} />
                    sync
                  </span>
                )}
              </div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatBRL(sheetKpis.faturamento)}
              </div>
              <div className="stat-label">Faturamento Total</div>
              <div className="stat-sub">
                {syncedCount > 0 ? `${syncedCount} registros sincronizados` : `${sheetKpis.totalSessoes} sessões no período`}
              </div>
            </div>

            {/* Total de Sessões */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-card-icon" style={{ background: 'var(--info-bg)', marginBottom: 8 }}>
                  <Calendar style={{ color: 'var(--info)' }} />
                </div>
              </div>
              <div className="stat-value">
                {sheetKpis.totalSessoes}
              </div>
              <div className="stat-label">Total de Sessões</div>
              <div className="stat-sub">
                {daysCount > 0 ? (sheetKpis.totalSessoes / daysCount).toFixed(1) : 0} sessões/dia no período
              </div>
            </div>

            {/* 1. Ticket Médio (por Sessão & por Cliente) */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-card-icon" style={{ background: '#F3E8FF', marginBottom: 8 }}>
                  <Tag style={{ color: '#8B5CF6' }} />
                </div>
              </div>
              <div className="stat-value" style={{ color: '#8B5CF6' }}>
                {formatBRL(sheetKpis.ticketMedio)}
              </div>
              <div className="stat-label">Ticket Médio por Sessão</div>
              <div className="stat-sub" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span><strong>Cliente:</strong> {formatBRL(ticketMedioPorCliente)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({sheetKpis.novosPacientes} clientes únicos)</span>
              </div>
            </div>

            {/* 5. Crescimento de Faturamento (Corrigido) */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-card-icon" style={{ background: growthCardData.bgIcon, marginBottom: 8 }}>
                  <growthCardData.icon style={{ color: growthCardData.cor }} />
                </div>
              </div>
              <div className="stat-value" style={{ color: growthCardData.cor }}>
                {growthCardData.val}
              </div>
              <div className="stat-label">Crescimento de Faturamento</div>
              <div className="stat-sub">{growthCardData.sub}</div>
            </div>

            {/* Faturamento Médio Diário */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-card-icon" style={{ background: 'var(--warning-bg)', marginBottom: 8 }}>
                  <TrendingUp style={{ color: 'var(--warning)' }} />
                </div>
              </div>
              <div className="stat-value">
                {formatBRL(daysCount > 0 ? sheetKpis.faturamento / daysCount : 0)}
              </div>
              <div className="stat-label">Média Diária</div>
              <div className="stat-sub">por dia no período ({daysCount}d)</div>
            </div>
          </>
        )}
      </div>

      {/* ─── Cashier History Table (100% Preservado) ──────────── */}
      <div className="card section-gap" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-dark)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Wallet style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
            Histórico de Caixas
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filteredCashierHistory.length} registro(s) • {formatDateBR(startDateStr)} –{' '}
            {formatDateBR(endDateStr)}
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Abertura</th>
                <th style={{ textAlign: 'right' }}>Fechamento</th>
                <th style={{ textAlign: 'right' }}>Sangria</th>
                <th style={{ textAlign: 'right' }}>Dinheiro</th>
                <th style={{ textAlign: 'right' }}>Pix</th>
                <th style={{ textAlign: 'right' }}>Crédito</th>
                <th style={{ textAlign: 'right' }}>Débito</th>
                <th style={{ textAlign: 'center' }}>Auto</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCashierHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}
                  >
                    Nenhum registro de caixa no período selecionado
                  </td>
                </tr>
              ) : (
                filteredCashierHistory.map((c, i) => {
                  const rawIn = numField(c, 'total_cash_in', 'dinheiro_entradas');
                  const rawOut = numField(c, 'total_cash_out', 'dinheiro_saidas');
                  const doDia = sheetByDate[c.date] || { pix: 0, credito: 0, debito: 0, dinheiro: 0, sangria: 0 };
                  const pix = doDia.pix;
                  const credito = doDia.credito;
                  const debito = doDia.debito;
                  const hasClosing =
                    c.closing_balance !== null &&
                    c.closing_balance !== undefined &&
                    c.closing_balance !== '';
                  const isAberto = c.status === 'aberto';
                  const opening = Number(c.opening_balance) || 0;
                  const closing = Number(c.closing_balance) || 0;

                  // 1. Sangria do dia
                  let sangria = rawOut > 0 ? rawOut : (doDia.sangria || 0);
                  if (sangria === 0 && hasClosing && opening > closing && rawIn === 0 && (doDia.dinheiro || 0) === 0) {
                    sangria = opening - closing;
                  }

                  // 2. Dinheiro do dia
                  let dinheiro = rawIn > 0 ? rawIn : (doDia.dinheiro || 0);
                  if (dinheiro === 0 && hasClosing) {
                    const diff = (closing - opening) + sangria;
                    if (diff > 0) dinheiro = diff;
                  }

                  return (
                    <tr key={c.id || i}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {formatDateBR(c.date)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {formatBRL(c.opening_balance)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: hasClosing ? 'var(--text-dark)' : 'var(--text-muted)',
                        }}
                      >
                        {hasClosing ? formatBRL(c.closing_balance) : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--danger)',
                          fontWeight: 600,
                        }}
                      >
                        {isAberto ? '—' : formatBRL(sangria)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--success)',
                          fontWeight: 600,
                        }}
                      >
                        {isAberto ? '—' : formatBRL(dinheiro)}
                      </td>
                      <td style={{ textAlign: 'right' }}>{isAberto ? '—' : formatBRL(pix)}</td>
                      <td style={{ textAlign: 'right' }}>{isAberto ? '—' : formatBRL(credito)}</td>
                      <td style={{ textAlign: 'right' }}>{isAberto ? '—' : formatBRL(debito)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {c.auto_closed ? (
                          <span className="badge badge-info">
                            <Zap style={{ width: 10, height: 10 }} />
                            Auto
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${isAberto ? 'badge-warning' : 'badge-success'}`}
                        >
                          {isAberto ? 'Aberto' : 'Fechado'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Charts row 1: Faturamento & 2. Mix de Receita por Forma de Pagamento ─── */}
      <div className="grid-2-1 section-gap">
        {/* Faturamento por Dia/Mês */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <TrendingUp />
              {faturamentoChart.daily ? 'Evolução do Faturamento por Dia' : 'Evolução Mensal do Faturamento'}
            </span>
          </div>
          {faturamentoChart.data.length > 0 && faturamentoChart.data.some((d) => d.valor > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={faturamentoChart.data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
                />
                <Tooltip
                  formatter={(v) => [formatBRL(v), 'Faturamento']}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar
                  dataKey="valor"
                  fill="var(--color-primary)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 260,
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Sem movimentações no período selecionado
            </div>
          )}
        </div>

        {/* 2. Mix de Receita por Forma de Pagamento */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="card-header">
            <span className="card-title">
              <CircleDollarSign />
              Mix de Receita por Pagamento
            </span>
          </div>

          {pagamentoData.length > 0 ? (
            <div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pagamentoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={75}
                      dataKey="value"
                      paddingAngle={4}
                    >
                      {pagamentoData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [
                        `${formatBRL(v)} (${totalPagamentos > 0 ? Math.round((v / totalPagamentos) * 100) : 0}%)`,
                        'Total',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Detalhamento com barras de progresso */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {pagamentoStats.map((st) => (
                  <div key={st.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
                        {st.name}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                        {formatBRL(st.value)}{' '}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                          ({st.pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 5, background: 'var(--border-light, #E5E7EB)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${st.pct}%`,
                          height: '100%',
                          background: st.color,
                          borderRadius: 99,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 240,
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Sem dados de pagamento no período
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. Ranking Serviços Mais Vendidos ─────────────────────── */}
      <div className="card section-gap">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <span className="card-title">
            <Award style={{ color: '#F59E0B' }} />
            Ranking: Serviços Mais Vendidos
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Ordenar por:</span>
            <div style={{ display: 'inline-flex', background: 'var(--bg-main, #F4F5F7)', padding: 2, borderRadius: 6, border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setServiceRankingSort('valor')}
                style={{
                  border: 'none',
                  background: serviceRankingSort === 'valor' ? 'var(--bg-card, #fff)' : 'transparent',
                  color: serviceRankingSort === 'valor' ? 'var(--text-dark)' : 'var(--text-muted)',
                  fontWeight: serviceRankingSort === 'valor' ? 700 : 500,
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: serviceRankingSort === 'valor' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Maior Faturamento (R$)
              </button>
              <button
                type="button"
                onClick={() => setServiceRankingSort('qtd')}
                style={{
                  border: 'none',
                  background: serviceRankingSort === 'qtd' ? 'var(--bg-card, #fff)' : 'transparent',
                  color: serviceRankingSort === 'qtd' ? 'var(--text-dark)' : 'var(--text-muted)',
                  fontWeight: serviceRankingSort === 'qtd' ? 700 : 500,
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: serviceRankingSort === 'qtd' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Mais Vendidos (Sessões)
              </button>
            </div>
          </div>
        </div>

        {servicosRankingList.length > 0 ? (
          <div>
            {/* Gráfico do Top 7 */}
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={Math.max(topRankingChart.length * 38, 140)}>
                <BarChart data={topRankingChart} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) =>
                      serviceRankingSort === 'qtd'
                        ? `${v} un`
                        : `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--text-medium)', fontWeight: 500 }}
                    width={150}
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      serviceRankingSort === 'qtd' ? `${v} sessões` : formatBRL(v),
                      serviceRankingSort === 'qtd' ? 'Sessões' : 'Faturamento',
                    ]}
                  />
                  <Bar
                    dataKey={serviceRankingSort === 'qtd' ? 'qtd' : 'valor'}
                    fill={serviceRankingSort === 'qtd' ? '#0284C7' : 'var(--color-primary, #C73B6D)'}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela do Ranking Completo */}
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 60, textAlign: 'center' }}>Posição</th>
                    <th>Procedimento / Serviço</th>
                    <th style={{ textAlign: 'center' }}>Sessões Vendidas</th>
                    <th style={{ textAlign: 'right' }}>Faturamento Gerado</th>
                    <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                    <th style={{ width: 180 }}>Participação no Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {servicosRankingList.map((s, idx) => {
                    const badgeIcon =
                      idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    return (
                      <tr key={s.nome}>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontSize: idx < 3 ? 16 : 12, color: 'var(--text-muted)' }}>
                          {badgeIcon}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-dark)' }}>
                          {s.nome}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--info)' }}>
                          {s.qtd}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                          {formatBRL(s.valor)}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>
                          {formatBRL(s.ticketMedio)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, s.pct)}%`,
                                  background: 'var(--color-primary)',
                                  borderRadius: 99,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, width: 34, textAlign: 'right' }}>
                              {s.pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            Nenhum procedimento registrado no período selecionado
          </div>
        )}
      </div>

      {/* ─── 4. Margem de Contribuição por Serviço ─────────────────── */}
      <div className="card section-gap">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span className="card-title">
              <Percent style={{ color: 'var(--success)' }} />
              Margem de Contribuição por Serviço
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Cálculo baseado no Preço Cobrado menos o Custo dos Insumos utilizados no procedimento
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--success-bg)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--success-border, #ABEBC6)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Margem Média da Clínica:</span>
              <strong style={{ fontSize: 15, color: 'var(--success)' }}>{resumoMargens.margemMediaGeral.toFixed(1)}%</strong>
            </div>
            <div style={{ background: '#EFF6FF', padding: '6px 12px', borderRadius: 8, border: '1px solid #BFDBFE' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Lucro Bruto Estimado:</span>
              <strong style={{ fontSize: 15, color: '#1D4ED8' }}>{formatBRL(resumoMargens.lucroBrutoTotal)}</strong>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Serviço / Procedimento</th>
                <th style={{ textAlign: 'right' }}>Preço de Venda</th>
                <th style={{ textAlign: 'right' }}>Custo Insumos</th>
                <th style={{ textAlign: 'right' }}>Margem Unitária (R$)</th>
                <th style={{ textAlign: 'center' }}>Margem %</th>
                <th style={{ textAlign: 'center' }}>Insumos Vinculados</th>
                <th style={{ textAlign: 'right' }}>Lucro Total no Período</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {margemServicosList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Nenhum serviço registrado
                  </td>
                </tr>
              ) : (
                margemServicosList.map((s) => {
                  const hasInsumos = s.insumos && s.insumos.length > 0;
                  const marginColor =
                    s.margemPct >= 70
                      ? 'var(--success)'
                      : s.margemPct >= 50
                      ? '#0284C7'
                      : s.margemPct >= 30
                      ? '#F59E0B'
                      : 'var(--danger)';

                  return (
                    <tr key={s.nome}>
                      <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-dark)' }}>
                        {s.nome}
                        {s.sessoes > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
                            {s.sessoes} sessão(ões) realizada(s)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatBRL(s.precoMedio)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#DC2626', fontWeight: 600 }}>
                        {formatBRL(s.custoInsumos)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        {formatBRL(s.margemReais)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${marginColor}18`,
                            color: marginColor,
                          }}
                        >
                          {s.margemPct.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {hasInsumos ? (
                          <span
                            title={s.insumos.map((i) => `${i.qtd}x ${i.insumoNome}`).join(', ')}
                            style={{
                              fontSize: 11,
                              color: 'var(--text-medium)',
                              background: 'var(--bg-main)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--border-color)',
                              cursor: 'help',
                            }}
                          >
                            {s.insumos.length} item(ns)
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sem vínculo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: s.lucroTotalNoPeriodo > 0 ? 'var(--text-dark)' : 'var(--text-muted)' }}>
                        {s.lucroTotalNoPeriodo > 0 ? formatBRL(s.lucroTotalNoPeriodo) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenModalInsumos(s.nome)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-card)',
                            color: 'var(--color-primary, #C73B6D)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Edit3 style={{ width: 11, height: 11 }} />
                          {hasInsumos ? 'Editar Insumos' : 'Vincular Insumos'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Modal para Vincular/Editar Insumos do Serviço ────────── */}
      {modalInsumos.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: 14,
              padding: 24,
              width: '100%',
              maxWidth: 620,
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
                  Insumos Consumidos no Procedimento
                </h3>
                <span style={{ fontSize: 13, color: 'var(--color-primary, #C73B6D)', fontWeight: 600 }}>
                  {modalInsumos.serviceName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalInsumos({ open: false, serviceName: '', insumos: [] })}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Defina quais produtos do estoque e quantidades são consumidos por sessão deste serviço para apuração exata do custo e da margem de lucro.
            </p>

            {/* Lista de Insumos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {modalInsumos.insumos.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 80px 100px 90px 32px',
                    gap: 8,
                    alignItems: 'center',
                    background: 'var(--bg-main, #F9FAFB)',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {/* Nome do insumo / Seleção do estoque */}
                  <div>
                    <input
                      type="text"
                      list="inventory-suggestions"
                      placeholder="Nome do produto/insumo"
                      value={row.insumoNome}
                      onChange={(e) => handleUpdateInsumoRow(idx, 'insumoNome', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: 12,
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Quantidade */}
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      placeholder="Qtd"
                      value={row.qtd}
                      onChange={(e) => handleUpdateInsumoRow(idx, 'qtd', Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: 12,
                        textAlign: 'center',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Unidade */}
                  <div>
                    <input
                      type="text"
                      placeholder="Unidade"
                      value={row.unidade || 'unidade'}
                      onChange={(e) => handleUpdateInsumoRow(idx, 'unidade', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: 12,
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Custo Unitário */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="R$ Custo"
                      value={row.custoUnitario}
                      onChange={(e) => handleUpdateInsumoRow(idx, 'custoUnitario', Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: 12,
                        textAlign: 'right',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Botão Remover */}
                  <button
                    type="button"
                    onClick={() => handleRemoveInsumoRow(idx)}
                    title="Remover insumo"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              ))}

              {modalInsumos.insumos.length === 0 && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-main)', borderRadius: 8 }}>
                  Nenhum insumo vinculado a este serviço.
                </div>
              )}
            </div>

            {/* Datalist com sugestões do estoque */}
            <datalist id="inventory-suggestions">
              {inventoryItems.map((inv) => (
                <option key={inv.id || inv.nome} value={inv.nome}>
                  {inv.nome} ({formatBRL(inv.preco)})
                </option>
              ))}
            </datalist>

            {/* Custo total calculado no modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '10px 14px', background: '#F3F4F6', borderRadius: 8 }}>
              <button
                type="button"
                onClick={handleAddInsumoRow}
                style={{
                  border: '1px dashed var(--color-primary, #C73B6D)',
                  background: 'transparent',
                  color: 'var(--color-primary, #C73B6D)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus style={{ width: 14, height: 14 }} /> Adicionar Insumo
              </button>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Custo Total de Insumos:</span>
                <strong style={{ fontSize: 15, color: '#DC2626' }}>
                  {formatBRL(
                    modalInsumos.insumos.reduce(
                      (sum, item) => sum + (Number(item.qtd) || 0) * (Number(item.custoUnitario) || 0),
                      0
                    )
                  )}
                </strong>
              </div>
            </div>

            {/* Botões do Rodapé */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalInsumos({ open: false, serviceName: '', insumos: [] })}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-medium)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModalInsumos}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-primary, #C73B6D)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Check style={{ width: 14, height: 14 }} /> Salvar Insumos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Professional ranking ───────────────────────────── */}
      <div className="card section-gap">
        <div className="card-header">
          <span className="card-title">
            <Users />
            Ranking de Profissionais
          </span>
        </div>
        {profRanking.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height={Math.max(profRanking.length * 50, 120)}
          >
            <BarChart
              data={profRanking}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-light)"
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v) =>
                  `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`
                }
              />
              <YAxis
                type="category"
                dataKey="nome"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-medium)' }}
                width={130}
              />
              <Tooltip formatter={(v) => [formatBRL(v), 'Comissão Total']} />
              <Bar
                dataKey="comissaoTotal"
                fill="var(--color-accent)"
                radius={[0, 4, 4, 0]}
                name="Comissão"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 160,
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            Sem dados no período
          </div>
        )}
      </div>
    </div>
  );
}
