// ==============================================================================
// src/services/marketingIdeasService.js — SERVIÇO DE IDEIAS E PLANEJAMENTO
// ------------------------------------------------------------------------------
// PAIEMAE | Gestão persistida de ideias, planejamento, tarefas, histórico e
// conversão/vínculo transacional com Campanhas de Marketing.
// ==============================================================================

import { supabase } from '../lib/supabase.js';

/**
 * Converte data ISO para exibição local America/Sao_Paulo
 */
export function formatDateTimeBR(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function formatDateBR(dateString) {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

/**
 * Carrega a lista de ideias (ativas ou arquivadas)
 */
export async function fetchIdeas({ arquivadas = false } = {}) {
  try {
    let query = supabase
      .from('marketing_ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (arquivadas) {
      query = query.eq('arquivada', true);
    } else {
      query = query.or('arquivada.is.null,arquivada.eq.false');
    }

    const { data, error } = await query;
    if (error) {
      // Código 42P01: relation "marketing_ideas" does not exist
      const isMissingTable = error.code === '42P01' || error.message?.includes('does not exist');
      return { data: [], error, structureMissing: isMissingTable };
    }
    const normalized = (data || []).map(row => ({
      ...row,
      etapa: row.etapa === 'executada' ? 'concluida' : (row.etapa || 'ideia'),
      aprovado: !!row.aprovado,
    }));
    return { data: normalized, error: null, structureMissing: false };
  } catch (err) {
    return { data: [], error: err, structureMissing: false };
  }
}

/**
 * Carrega ideia completa com tarefas e eventos
 */
export async function fetchIdeaById(id) {
  if (!id) return { data: null, error: new Error('ID da ideia não informado.') };
  try {
    const { data: ideia, error: ideiaErr } = await supabase
      .from('marketing_ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideiaErr) return { data: null, error: ideiaErr };

    const normalizedIdeia = {
      ...ideia,
      etapa: ideia.etapa === 'executada' ? 'concluida' : (ideia.etapa || 'ideia'),
      aprovado: !!ideia.aprovado,
    };

    // Tarefas
    const { data: tasks } = await supabase
      .from('marketing_idea_tasks')
      .select('*')
      .eq('ideia_id', id)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    // Eventos (tenta marketing_idea_events, fallback marketing_idea_history)
    let events = [];
    const { data: evts, error: evtsErr } = await supabase
      .from('marketing_idea_events')
      .select('*')
      .eq('ideia_id', id)
      .order('created_at', { ascending: false });

    if (!evtsErr && evts) {
      events = evts;
    } else {
      const { data: hist } = await supabase
        .from('marketing_idea_history')
        .select('*')
        .eq('ideia_id', id)
        .order('created_at', { ascending: false });
      events = (hist || []).map(h => ({
        id: h.id,
        ideia_id: h.ideia_id,
        tipo: 'status',
        autor_id: h.autor_id,
        autor_nome: null,
        dados: { status_de: h.status_de, status_para: h.status_para, nota: h.nota },
        created_at: h.created_at,
      }));
    }

    return { data: normalizedIdeia, tasks: tasks || [], events, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Insere nova ideia com validação
 */
export async function insertIdea(rawPayload, author = null) {
  const titulo = (rawPayload.titulo || '').trim();
  if (!titulo) {
    return { data: null, error: new Error('O título da ideia é obrigatório.') };
  }
  if (titulo.length > 120) {
    return { data: null, error: new Error('O título não pode exceder 120 caracteres.') };
  }

  const payload = {
    titulo,
    descricao: (rawPayload.descricao || '').trim(),
    formato: rawPayload.formato || 'Não definido',
    canal: rawPayload.canal || 'Instagram',
    tipo: rawPayload.tipo || 'conteudo',
    etapa: rawPayload.etapa || 'ideia',
    status: rawPayload.status || 'ideia',
    servico_tema: (rawPayload.servico_tema || '').trim(),
    objetivo: (rawPayload.objetivo || '').trim(),
    publico: (rawPayload.publico || '').trim(),
    regiao: (rawPayload.regiao || '').trim(),
    canais_divulgacao: Array.isArray(rawPayload.canais_divulgacao) ? rawPayload.canais_divulgacao : [],
    destino: (rawPayload.destino || '').trim(),
    cta: (rawPayload.cta || '').trim(),
    responsavel_id: rawPayload.responsavel_id || null,
    responsavel_nome: (rawPayload.responsavel_nome || '').trim(),
    data_prevista: rawPayload.data_prevista || null,
    orcamento_estimado: rawPayload.orcamento_estimado != null && rawPayload.orcamento_estimado !== ''
      ? Math.max(0, parseFloat(rawPayload.orcamento_estimado) || 0)
      : null,
    roteiro: (rawPayload.roteiro || '').trim(),
    participantes: (rawPayload.participantes || '').trim(),
    materiais: (rawPayload.materiais || '').trim(),
    data_real: rawPayload.data_real || null,
    aprendizado: (rawPayload.aprendizado || '').trim(),
    campanha_id: rawPayload.campanha_id || null,
    tags: Array.isArray(rawPayload.tags) ? rawPayload.tags : [],
    modelo_live: rawPayload.modelo_live || null,
    criado_por: author?.id || null,
    arquivada: false,
    versao: 1,
  };

  try {
    const { data, error } = await supabase
      .from('marketing_ideas')
      .insert([payload])
      .select()
      .single();

    if (error) return { data: null, error };

    // Registra evento de criação se a tabela existir
    if (data?.id) {
      await supabase.from('marketing_idea_events').insert([{
        ideia_id: data.id,
        tipo: 'criacao',
        autor_id: author?.id || null,
        autor_nome: author?.name || author?.email || null,
        dados: { titulo: data.titulo, etapa: data.etapa },
      }]).catch(() => {});
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Atualiza ideia com verificação de concorrência e regras de etapa
 */
export async function updateIdea(id, patch, author = null, currentVersion = null) {
  if (!id) return { data: null, error: new Error('ID da ideia não informado.') };

  try {
    // 1. Busca registro atual para verificar concorrência e validar regras
    const { data: current, error: fetchErr } = await supabase
      .from('marketing_ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr) return { data: null, error: fetchErr };

    // Detecção de conflito de edição concorrente
    if (currentVersion != null && current.versao != null && current.versao !== currentVersion) {
      return {
        data: null,
        conflict: true,
        error: new Error('Este registro foi modificado por outro usuário. Recarregue os dados para não sobrescrever as alterações.'),
        serverData: current,
      };
    }

    // 2. Regras de transição de etapa e aprovação
    const nextEtapa = patch.etapa || current.etapa;
    const nextResp = patch.responsavel_id !== undefined ? patch.responsavel_id : current.responsavel_id;
    const nextRespNome = patch.responsavel_nome !== undefined ? patch.responsavel_nome : current.responsavel_nome;
    const nextDataPrev = patch.data_prevista !== undefined ? patch.data_prevista : current.data_prevista;
    const nextObj = patch.objetivo !== undefined ? patch.objetivo : current.objetivo;
    const nextCanais = patch.canais_divulgacao !== undefined ? patch.canais_divulgacao : (current.canais_divulgacao || []);

    // Para transições a Agendada, Em execução ou Concluída, exigir aprovação
    const isAprovado = patch.aprovado !== undefined ? !!patch.aprovado : !!current.aprovado;
    if (['agendada', 'em_execucao', 'concluida', 'executada'].includes(nextEtapa) && !isAprovado) {
      return {
        data: null,
        error: new Error('Para agendar ou colocar a ideia em execução, ela deve ser aprovada primeiro.'),
      };
    }

    if (nextEtapa === 'agendada') {
      const temResp = !!(nextResp || (nextRespNome && nextRespNome.trim()));
      const temData = !!nextDataPrev;
      const temObj = !!(nextObj && nextObj.trim());
      const temCanais = Array.isArray(nextCanais) && nextCanais.length > 0;

      if (!temResp || !temData || !temObj || !temCanais) {
        const faltantes = [];
        if (!temResp) faltantes.push('Responsável');
        if (!temData) faltantes.push('Data prevista');
        if (!temObj) faltantes.push('Objetivo');
        if (!temCanais) faltantes.push('Ao menos um canal de divulgação');
        return {
          data: null,
          error: new Error(`Para agendar a ideia, preencha: ${faltantes.join(', ')}.`),
        };
      }
    }

    if (nextEtapa === 'concluida' || nextEtapa === 'executada') {
      const nextDataReal = patch.data_real !== undefined ? patch.data_real : current.data_real;
      if (!nextDataReal) {
        return {
          data: null,
          error: new Error('Para marcar como Concluída, informe a data real da execução.'),
        };
      }
    }

    // 3. Montar payload de atualização
    const cleanPatch = { ...patch };
    if (cleanPatch.titulo !== undefined) {
      cleanPatch.titulo = cleanPatch.titulo.trim();
      if (!cleanPatch.titulo) return { data: null, error: new Error('O título não pode ser vazio.') };
      if (cleanPatch.titulo.length > 120) return { data: null, error: new Error('O título excede 120 caracteres.') };
    }
    if (cleanPatch.orcamento_estimado !== undefined && cleanPatch.orcamento_estimado !== null && cleanPatch.orcamento_estimado !== '') {
      cleanPatch.orcamento_estimado = Math.max(0, parseFloat(cleanPatch.orcamento_estimado) || 0);
    }

    // Incrementa versão
    cleanPatch.versao = (current.versao || 1) + 1;
    cleanPatch.updated_at = new Date().toISOString();

    // Atualização com condição de versão no banco para garantir atomicidade real contra edição simultânea
    let updateQuery = supabase
      .from('marketing_ideas')
      .update(cleanPatch)
      .eq('id', id);

    if (currentVersion != null) {
      updateQuery = updateQuery.eq('versao', currentVersion);
    }

    const { data: updated, error: updErr } = await updateQuery
      .select()
      .maybeSingle();

    if (updErr) return { data: null, error: updErr };

    // Se nenhuma linha foi atualizada, outro usuário alterou a versão simultaneamente
    if (!updated && currentVersion != null) {
      let latest = null;
      try {
        const { data } = await supabase.from('marketing_ideas').select('*').eq('id', id).maybeSingle();
        latest = data;
      } catch (_) {
        // Fallback silencioso se não conseguir carregar dado mais recente
      }
      return {
        data: null,
        conflict: true,
        error: new Error('Este registro foi modificado por outro usuário. Recarregue os dados para não sobrescrever as alterações.'),
        serverData: latest,
      };
    }

    // 4. Registrar evento se houve mudança relevante (etapa, responsável, data)
    const eventos = [];
    if (patch.etapa && patch.etapa !== current.etapa) {
      eventos.push({
        ideia_id: id,
        tipo: 'status',
        autor_id: author?.id || null,
        autor_nome: author?.name || author?.email || null,
        dados: { etapa_de: current.etapa, etapa_para: patch.etapa, motivo: patch.motivo || '' },
      });
    }

    if (patch.responsavel_id !== undefined && patch.responsavel_id !== current.responsavel_id) {
      eventos.push({
        ideia_id: id,
        tipo: 'campo',
        autor_id: author?.id || null,
        autor_nome: author?.name || author?.email || null,
        dados: {
          campo: 'responsavel',
          de: current.responsavel_nome,
          para: patch.responsavel_nome,
        },
      });
    }

    if (patch.data_prevista !== undefined && patch.data_prevista !== current.data_prevista) {
      eventos.push({
        ideia_id: id,
        tipo: 'campo',
        autor_id: author?.id || null,
        autor_nome: author?.name || author?.email || null,
        dados: { campo: 'data_prevista', de: current.data_prevista, para: patch.data_prevista },
      });
    }

    if (eventos.length > 0) {
      await supabase.from('marketing_idea_events').insert(eventos).catch(() => {});
    }

    return { data: updated, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Arquivar ou Restaurar ideia
 */
export async function archiveIdea(id, arquivar = true, author = null) {
  if (!id) return { ok: false, error: new Error('ID não informado.') };

  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_arquivar_ideia', {
      p_ideia_id: id,
      p_arquivar: arquivar,
      p_autor_id: author?.id || null,
      p_autor_nome: author?.name || author?.email || null,
    });

    if (rpcErr) {
      return { ok: false, error: new Error(rpcErr.message || 'Erro ao arquivar ideia.') };
    }
    if (rpcRes?.ok === false) {
      return { ok: false, error: new Error(rpcRes.error || 'Falha ao arquivar ideia.') };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Duplicar ideia: cria novo registro no status 'ideia' com tarefas estruturais
 * mas limpa vínculos, conclusões e datas de execução
 */
export async function duplicateIdea(id, author = null) {
  if (!id) return { data: null, error: new Error('ID não informado.') };

  try {
    const { data: orig, tasks } = await fetchIdeaById(id);
    if (!orig) return { data: null, error: new Error('Ideia original não encontrada.') };

    const copiaTitulo = orig.titulo.length > 110
      ? `${orig.titulo.slice(0, 110)} (Cópia)`
      : `${orig.titulo} (Cópia)`;

    const novoPayload = {
      titulo: copiaTitulo,
      descricao: orig.descricao || '',
      formato: orig.formato || 'Não definido',
      canal: orig.canal || 'Instagram',
      tipo: orig.tipo || 'conteudo',
      etapa: 'ideia',
      status: 'ideia',
      servico_tema: orig.servico_tema || '',
      objetivo: orig.objetivo || '',
      publico: orig.publico || '',
      regiao: orig.regiao || '',
      canais_divulgacao: orig.canais_divulgacao || [],
      destino: orig.destino || '',
      cta: orig.cta || '',
      responsavel_id: orig.responsavel_id || null,
      responsavel_nome: orig.responsavel_nome || '',
      data_prevista: null,
      orcamento_estimado: orig.orcamento_estimado || null,
      roteiro: orig.roteiro || '',
      participantes: orig.participantes || '',
      materiais: orig.materiais || '',
      data_real: null,
      aprendizado: '',
      campanha_id: null,
      tags: orig.tags || [],
      modelo_live: orig.modelo_live || null,
      criado_por: author?.id || null,
      arquivada: false,
      versao: 1,
    };

    const { data: nova, error: novaErr } = await supabase
      .from('marketing_ideas')
      .insert([novoPayload])
      .select()
      .single();

    if (novaErr) return { data: null, error: novaErr };

    // Clona tarefas pendentes
    if (tasks && tasks.length > 0) {
      const tarefasClonadas = tasks.map((t, idx) => ({
        ideia_id: nova.id,
        titulo: t.titulo,
        concluida: false,
        responsavel: t.responsavel || null,
        prazo: null,
        ordem: t.ordem ?? idx,
      }));
      await supabase.from('marketing_idea_tasks').insert(tarefasClonadas).catch(() => {});
    }

    // Registra evento de duplicação
    await supabase.from('marketing_idea_events').insert([{
      ideia_id: nova.id,
      tipo: 'duplicacao',
      autor_id: author?.id || null,
      autor_nome: author?.name || author?.email || null,
      dados: { origem_id: orig.id, origem_titulo: orig.titulo },
    }]).catch(() => {});

    return { data: nova, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Transforma ideia em rascunho de campanha de forma transacional (RPC Postgres)
 */
export async function convertIdeaToCampaign({
  ideiaId,
  nome,
  canal = 'Instagram',
  mensagem = '',
  publico = '',
  orcamento = 0,
  dataInicio = '',
  author = null,
}) {
  if (!ideiaId) return { ok: false, error: new Error('ID da ideia não fornecido.') };
  if (!nome || !nome.trim()) return { ok: false, error: new Error('Nome da campanha é obrigatório.') };

  try {
    // 1. Chama a RPC transacional segura
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_convert_ideia_to_rascunho', {
      p_ideia_id: ideiaId,
      p_nome_camp: nome.trim(),
      p_canal_camp: canal || 'Instagram',
      p_mensagem: mensagem || '',
      p_publico: publico || '',
      p_orcamento: parseFloat(orcamento) || 0,
      p_data_inicio: dataInicio || '',
      p_autor_id: author?.id || null,
      p_autor_nome: author?.name || author?.email || null,
    });

    if (rpcErr) {
      // Se a função não existe no banco, instruir o usuário
      if (rpcErr.code === '42883' || rpcErr.message?.includes('fn_convert_ideia_to_rascunho')) {
        return {
          ok: false,
          error: new Error('A migração incremental (v2) ainda não foi aplicada no Supabase. Execute o arquivo marketing_ideas_migration_v2.sql no SQL Editor.'),
        };
      }
      return { ok: false, error: new Error(rpcErr.message || 'Erro ao converter ideia.') };
    }

    if (rpcRes && rpcRes.ok === false) {
      return { ok: false, error: new Error(rpcRes.error || 'Falha ao converter ideia.') };
    }

    return {
      ok: true,
      idempotente: !!rpcRes?.idempotente,
      campanhaId: rpcRes?.campanha_id,
      campanhaNome: rpcRes?.campanha_nome,
      data: rpcRes,
    };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Vincula ideia a uma campanha existente via RPC com histórico
 */
export async function linkIdeaCampaign(ideiaId, campanhaId, author = null) {
  if (!ideiaId || !campanhaId) return { ok: false, error: new Error('Parâmetros inválidos.') };

  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_vincular_ideia_campanha', {
      p_ideia_id: ideiaId,
      p_campanha_id: campanhaId,
      p_autor_id: author?.id || null,
      p_autor_nome: author?.name || author?.email || null,
    });

    if (rpcErr) {
      return { ok: false, error: new Error(rpcErr.message || 'Erro ao vincular campanha.') };
    }
    if (rpcRes?.ok === false) {
      return { ok: false, error: new Error(rpcRes.error || 'Falha ao vincular campanha.') };
    }
    return { ok: true, data: rpcRes };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Desvincula ideia de campanha
 */
export async function unlinkIdeaCampaign(ideiaId, currentCampaignId = null, author = null) {
  if (!ideiaId) return { ok: false, error: new Error('ID da ideia não informado.') };

  try {
    const { error: updErr } = await supabase
      .from('marketing_ideas')
      .update({ campanha_id: null, updated_at: new Date().toISOString() })
      .eq('id', ideiaId);

    if (updErr) return { ok: false, error: updErr };

    await supabase.from('marketing_idea_events').insert([{
      ideia_id: ideiaId,
      tipo: 'vinculo',
      autor_id: author?.id || null,
      autor_nome: author?.name || author?.email || null,
      dados: { campanha_id_anterior: currentCampaignId, acao: 'desvinculada' },
    }]).catch(() => {});

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Busca ideias vinculadas a uma campanha específica (para CampanhaDetail)
 */
export async function fetchLinkedIdeasForCampaign(campaignId) {
  if (!campaignId) return [];
  try {
    const { data } = await supabase
      .from('marketing_ideas')
      .select('id, titulo, etapa, formato, data_prevista, aprovado')
      .eq('campanha_id', campaignId);
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Tarefas CRUD
 */
export async function fetchIdeaTasks(ideiaId) {
  if (!ideiaId) return [];
  const { data } = await supabase
    .from('marketing_idea_tasks')
    .select('*')
    .eq('ideia_id', ideiaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true });
  return data || [];
}

export async function upsertIdeaTask(taskData) {
  if (!taskData.ideia_id || !taskData.titulo) {
    return { data: null, error: new Error('Dados da tarefa incompletos.') };
  }
  const payload = {
    ideia_id: taskData.ideia_id,
    titulo: taskData.titulo.trim(),
    concluida: !!taskData.concluida,
    responsavel: taskData.responsavel || null,
    prazo: taskData.prazo || null,
    ordem: taskData.ordem ?? 0,
  };
  if (taskData.id) payload.id = taskData.id;

  const { data, error } = await supabase
    .from('marketing_idea_tasks')
    .upsert([payload])
    .select()
    .single();

  return { data, error };
}

export async function deleteIdeaTask(taskId) {
  if (!taskId) return { error: null };
  const { error } = await supabase
    .from('marketing_idea_tasks')
    .delete()
    .eq('id', taskId);
  return { error };
}

/**
 * Eventos / Histórico / Comentários
 */
export async function fetchIdeaEvents(ideiaId) {
  if (!ideiaId) return [];
  try {
    const { data, error } = await supabase
      .from('marketing_idea_events')
      .select('*')
      .eq('ideia_id', ideiaId)
      .order('created_at', { ascending: false });

    if (!error && data) return data;

    // Fallback histórico
    const { data: hist } = await supabase
      .from('marketing_idea_history')
      .select('*')
      .eq('ideia_id', ideiaId)
      .order('created_at', { ascending: false });

    return (hist || []).map(h => ({
      id: h.id,
      tipo: 'status',
      autor_nome: null,
      dados: { status_de: h.status_de, status_para: h.status_para, nota: h.nota },
      created_at: h.created_at,
    }));
  } catch {
    return [];
  }
}

export async function addIdeaComment(ideiaId, commentText, author = null) {
  if (!ideiaId || !commentText?.trim()) {
    return { ok: false, error: new Error('Comentário não pode ser vazio.') };
  }
  try {
    const { data, error } = await supabase
      .from('marketing_idea_events')
      .insert([{
        ideia_id: ideiaId,
        tipo: 'comentario',
        autor_id: author?.id || null,
        autor_nome: author?.name || author?.email || null,
        dados: { comentario: commentText.trim() },
      }])
      .select()
      .single();

    if (error) return { ok: false, error };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Busca lista segura de membros da equipe autorizados para seletor de responsável
 */
export async function fetchAuthorizedStaff() {
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('list_team_members');
    if (!rpcErr && rpcData && Array.isArray(rpcData)) {
      return rpcData.map(u => ({
        id: u.id,
        nome: u.full_name || u.name || u.email || 'Usuário',
        cargo: u.cargo || u.role || '',
      }));
    }
  } catch {
    // continua para fallback
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, cargo, role')
      .limit(50);

    if (!error && data) {
      return data.map(p => ({
        id: p.id,
        nome: p.full_name || 'Usuário',
        cargo: p.cargo || p.role || '',
      }));
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Aprovação e Retirada de Aprovação com histórico
 */
export async function approveIdea(id, aprovado = true, motivo = '', author = null) {
  if (!id) return { ok: false, error: new Error('ID não informado.') };

  try {
    // 1. Tenta RPC transacional
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_aprovar_ideia', {
      p_ideia_id: id,
      p_aprovado: aprovado,
      p_motivo: motivo || '',
      p_autor_id: author?.id || null,
      p_autor_nome: author?.name || author?.email || null,
    });

    if (!rpcErr && rpcRes) {
      if (rpcRes.ok === false) {
        return { ok: false, error: new Error(rpcRes.error || 'Erro ao aprovar ideia.') };
      }
      return { ok: true, data: rpcRes };
    }

    // 2. Fallback direto se a RPC ainda não tiver sido criada
    const { data: cur, error: curErr } = await supabase
      .from('marketing_ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (curErr) return { ok: false, error: curErr };

    // Se estiver retirando aprovação mas a ideia já está em execução ou concluída, impede
    if (!aprovado && ['em_execucao', 'concluida', 'executada'].includes(cur.etapa)) {
      return {
        ok: false,
        error: new Error('Não é possível retirar a aprovação de uma ação já em execução ou concluída. Retorne a etapa para planejamento antes.'),
      };
    }

    const { data: upd, error: updErr } = await supabase
      .from('marketing_ideas')
      .update({
        aprovado,
        aprovado_em: aprovado ? new Date().toISOString() : null,
        aprovado_por: aprovado ? (author?.id || null) : null,
        aprovador_nome: aprovado ? (author?.name || author?.email || 'Usuário') : '',
        versao: (cur.versao || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) return { ok: false, error: updErr };

    await supabase.from('marketing_idea_events').insert([{
      ideia_id: id,
      tipo: 'aprovacao',
      autor_id: author?.id || null,
      autor_nome: author?.name || author?.email || null,
      dados: { aprovado, motivo: motivo || '', etapa_atual: cur.etapa },
    }]).catch(() => {});

    return { ok: true, data: upd };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Carrega Layout da Lousa Digital.
 * Propaga erros reais — não retorna lousa vazia quando há falha de permissão/migração.
 */
export async function fetchWhiteboardLayout(contexto = 'default') {
  try {
    const { data, error } = await supabase
      .from('marketing_whiteboards')
      .select('*')
      .eq('contexto', contexto)
      .maybeSingle();

    if (error) {
      const isMissingTable =
        error.code === '42P01' ||
        error.code === 'PGRST116' ||
        error.message?.includes('does not exist');

      if (isMissingTable) {
        // Tabela ainda não foi criada — migração pendente
        return {
          data: null, versao: 1, structureMissing: true,
          error: new Error('A tabela de lousa ainda não existe. Execute a migração SQL completa no Supabase.'),
        };
      }

      // Erro real (permissão, timeout, etc.) — propagar
      return {
        data: null, versao: 1, structureMissing: false,
        error: new Error(error.message || 'Erro ao carregar lousa.'),
      };
    }

    if (!data) {
      // Lousa ainda não tem registro — estado inicial válido, versao 0 (ainda não gravada)
      return { data: { nodes: [], edges: [] }, versao: 0, structureMissing: false, error: null };
    }

    return {
      data: data.layout || { nodes: [], edges: [] },
      versao: data.versao || 1,
      structureMissing: false,
      updated_at: data.updated_at,
      updated_by_nome: data.updated_by_nome,
      error: null,
    };
  } catch (err) {
    return { data: null, versao: 1, structureMissing: false, error: err };
  }
}

/**
 * Salva Layout da Lousa com Controle de Versão e Concorrência.
 * Usa exclusivamente a RPC atômica — sem fallback que contorna rejeições.
 */
export async function saveWhiteboardLayout({
  contexto = 'default',
  layout,
  versaoEsperada = 1,
  author = null,
}) {
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_save_marketing_whiteboard', {
      p_contexto: contexto,
      p_layout: layout,
      p_versao_esperada: versaoEsperada,
      p_autor_id: author?.id || null,
      p_autor_nome: author?.name || author?.email || null,
    });

    if (rpcErr) {
      // RPC não existe (migração pendente) ou erro de permissão
      return {
        ok: false,
        error: new Error(rpcErr.message || 'Erro ao salvar lousa. Verifique se a migração SQL foi aplicada.'),
      };
    }

    if (!rpcRes) {
      return { ok: false, error: new Error('Resposta vazia da RPC de salvamento.') };
    }

    if (rpcRes.conflict) {
      return {
        ok: false,
        conflict: true,
        error: new Error(rpcRes.error || 'A lousa foi alterada por outro usuário.'),
        versaoServidor: rpcRes.versao_servidor,
        layoutServidor: rpcRes.layout_servidor,
      };
    }

    if (rpcRes.ok === false) {
      return { ok: false, error: new Error(rpcRes.error || 'Falha ao salvar lousa.') };
    }

    return { ok: true, versao: rpcRes.versao };
  } catch (err) {
    return { ok: false, error: err };
  }
}
