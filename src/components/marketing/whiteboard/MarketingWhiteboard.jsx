/* eslint-disable react/prop-types */
/**
 * MarketingWhiteboard.jsx — Lousa digital de ideias
 *
 * CORREÇÕES DE CONCORRÊNCIA, PERSISTÊNCIA E FLUXO (2026-10-08):
 * 1. Hidratação separada: inicialização ≠ atualização de dados de negócio ≠ modo conexão.
 *    isConnectingMode e connectionSourceId NÃO disparam re-hidratação de nós.
 * 2. Versão gerenciada por ref (versionRef) e gravação serializada:
 *    Edições consecutivas de post-its avançam a versão corretamente e enfileiram alterações
 *    feitas durante gravações em voo, eliminando erros de versão desatualizada.
 * 3. Persistência de layout completo:
 *    Filtros alteram apenas a visibilidade (hidden: true) em tela; o payload de persistência
 *    sempre preserva todas as posições e setas de cartões filtrados.
 * 4. Desfazer atômico e confiável:
 *    Calcula o estado pós-desfazer antes de solicitar persistência;
 *    Restaura arrastes (move_node), exclusões de notas com suas setas (delete_node) e conexões.
 * 5. Erros de carregamento tratados explicitamente:
 *    Falhas de leitura/permissão são exibidas ao usuário e bloqueiam o autosave para não corromper o banco.
 * 6. Arquivamento protegido no canvas:
 *    onBeforeDelete intercepta a tentativa de exclusão de cartões de ideia antes que o ReactFlow os remova.
 *    Cancelar a confirmação deixa o cartão e suas ligações 100% intactos.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus, StickyNote, Type, Link as LinkIcon, Undo,
  Maximize2, ZoomIn, ZoomOut, AlertCircle, Check,
  Clock, Sparkles, Archive, X, RefreshCw, AlertTriangle,
} from 'lucide-react';
import MarketingIdeaNode from './MarketingIdeaNode';
import MarketingNoteNode from './MarketingNoteNode';
import MarketingTextNode from './MarketingTextNode';

const nodeTypes = {
  ideaNode: MarketingIdeaNode,
  noteNode: MarketingNoteNode,
  textNode: MarketingTextNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#8B5CF6', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#8B5CF6',
    width: 16,
    height: 16,
  },
};

// ─── Helpers de Construção de Nós ─────────────────────────────────────────────

function buildIdeaNodes(ideias, savedNodesMap, isReadOnly, callbacks, visibleIdeaIds) {
  return ideias.map((ideia, idx) => {
    const existing = savedNodesMap.get(ideia.id);
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const defaultX = 80 + col * 310;
    const defaultY = 80 + row * 280;
    const isHidden = visibleIdeaIds ? !visibleIdeaIds.has(ideia.id) : false;

    return {
      id: ideia.id,
      type: 'ideaNode',
      position: existing?.position || { x: defaultX, y: defaultY },
      hidden: isHidden,
      data: {
        idea: ideia,
        isReadOnly,
        ...callbacks,
      },
    };
  });
}

function buildCustomNodes(savedNodes, isReadOnly, callbacks) {
  return savedNodes
    .filter(n => n.type === 'noteNode' || n.type === 'textNode')
    .map(n => ({
      ...n,
      hidden: false,
      data: {
        ...n.data,
        isReadOnly,
        ...callbacks,
      },
    }));
}

// ─── Componente Interno ───────────────────────────────────────────────────────

function WhiteboardInner({
  ideias = [],
  visibleIdeaIds = null,
  isReadOnly = false,
  onOpenFicha,
  onNewIdeaQuick,
  onUsarModeloLive,
  onArchiveIdea,
  onApproveIdea,
  layoutData,
  layoutVersion,
  layoutError,
  onSaveLayout,
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict' | 'load_error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');

  // Refs de estado síncrono para evitar closures desatualizadas
  const versionRef = useRef(layoutVersion != null ? layoutVersion : 0);
  const latestNodesRef = useRef([]);
  const latestEdgesRef = useRef([]);
  const isSavingRef = useRef(false);
  const hasPendingChangesRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const pendingSaveRef = useRef(null); // { newNodes, newEdges } explicitamente calculados
  const layoutLoadedRef = useRef(false);
  const initializedRef = useRef(false);

  // Modo conectar
  const [isConnectingMode, setIsConnectingMode] = useState(false);
  const connectingModeRef = useRef(false);
  const connectionSourceRef = useRef(null);
  const [connectionSourceId, setConnectionSourceId] = useState(null);

  // Modal de confirmação de arquivamento
  const [confirmArchiveIdea, setConfirmArchiveIdea] = useState(null);

  // Pilha de desfazer (Undo)
  const undoStackRef = useRef([]);
  const dragStartPositionsRef = useRef(new Map());

  // Sincroniza refs com estado mais recente
  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    latestEdgesRef.current = edges;
  }, [edges]);

  // Atualiza versionRef quando layoutVersion inicial do servidor chega
  useEffect(() => {
    if (layoutVersion != null) {
      versionRef.current = layoutVersion;
    }
  }, [layoutVersion]);

  // Aviso ao tentar fechar página com alterações pendentes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasPendingChangesRef.current || isSavingRef.current || saveStatus === 'pending') {
        e.preventDefault();
        e.returnValue = 'Existem alterações na lousa que ainda não foram salvas.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveStatus]);

  // ─── Callbacks de Nós Estáveis ─────────────────────────────────────────────

  const handleApproveToggle = useCallback((ideia) => {
    onApproveIdea(ideia.id, !ideia.aprovado);
    setNodes(nds => nds.map(n =>
      n.id === ideia.id
        ? { ...n, data: { ...n.data, idea: { ...ideia, aprovado: !ideia.aprovado } } }
        : n
    ));
  }, [onApproveIdea]);

  const handleNoteTextChange = useCallback((id, newText) => {
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, text: newText } } : n
      );
      triggerSave(updated, null);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNoteColorChange = useCallback((id, newColor) => {
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, color: newColor } } : n
      );
      triggerSave(updated, null);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteCustomNode = useCallback((id) => {
    if (isReadOnly) return;
    const currentNodes = latestNodesRef.current;
    const currentEdges = latestEdgesRef.current;

    const target = currentNodes.find(n => n.id === id);
    const deletedEdges = [];
    const nextEdges = currentEdges.filter(e => {
      const keep = e.source !== id && e.target !== id;
      if (!keep) deletedEdges.push(e);
      return keep;
    });
    const nextNodes = currentNodes.filter(n => n.id !== id);

    if (target) {
      undoStackRef.current.push({ type: 'delete_node', node: target, edges: deletedEdges });
    }

    setNodes(nextNodes);
    setEdges(nextEdges);
    triggerSave(nextNodes, nextEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly]);

  const handleNodeSelectForConnect = useCallback((nodeId) => {
    if (!connectingModeRef.current) return;
    if (!connectionSourceRef.current) {
      connectionSourceRef.current = nodeId;
      setConnectionSourceId(nodeId);
    } else {
      if (connectionSourceRef.current !== nodeId) {
        const newEdge = {
          id: `edge-${connectionSourceRef.current}-${nodeId}-${Date.now()}`,
          source: connectionSourceRef.current,
          target: nodeId,
          ...defaultEdgeOptions,
        };
        undoStackRef.current.push({ type: 'add_edge', edge: newEdge });
        const nextEdges = [...latestEdgesRef.current, newEdge];
        setEdges(nextEdges);
        triggerSave(null, nextEdges);
      }
      connectionSourceRef.current = null;
      setConnectionSourceId(null);
      connectingModeRef.current = false;
      setIsConnectingMode(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stableCallbacks = {
    onOpenFicha,
    onApproveToggle: handleApproveToggle,
    isConnectingMode: false,
    isConnectionSource: false,
    onNodeSelectForConnect: handleNodeSelectForConnect,
    onChangeText: handleNoteTextChange,
    onChangeColor: handleNoteColorChange,
    onDeleteNote: handleDeleteCustomNode,
    onDeleteText: handleDeleteCustomNode,
  };

  // ─── 1. Hidratação Inicial: Apenas quando layoutData/layoutVersion chegam ───

  useEffect(() => {
    if (layoutError) {
      setSaveStatus('load_error');
      setSaveError(layoutError.message || 'Erro ao carregar lousa.');
      layoutLoadedRef.current = false;
      return;
    }

    const savedNodes = layoutData?.nodes || [];
    const savedEdges = layoutData?.edges || [];
    const savedNodesMap = new Map(savedNodes.map(n => [n.id, n]));

    versionRef.current = layoutVersion != null ? layoutVersion : 0;
    layoutLoadedRef.current = true;

    const allIdeaIds = new Set(ideias.map(i => i.id));
    const ideaNodes = buildIdeaNodes(ideias, savedNodesMap, isReadOnly, stableCallbacks, visibleIdeaIds);
    const customNodes = buildCustomNodes(savedNodes, isReadOnly, stableCallbacks);

    const processedEdges = savedEdges.map(e => {
      const sourceIsHiddenIdea = visibleIdeaIds ? (allIdeaIds.has(e.source) && !visibleIdeaIds.has(e.source)) : false;
      const targetIsHiddenIdea = visibleIdeaIds ? (allIdeaIds.has(e.target) && !visibleIdeaIds.has(e.target)) : false;
      const isHidden = sourceIsHiddenIdea || targetIsHiddenIdea;
      if (e.hidden === isHidden) return e;
      return { ...e, hidden: isHidden };
    });

    setNodes([...ideaNodes, ...customNodes]);
    setEdges(processedEdges);
    setSaveStatus('saved');
    initializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutData, layoutVersion, layoutError]);

  // ─── 2. Sincroniza dados de negócio das ideias sem tocar posições ───────────

  useEffect(() => {
    if (!initializedRef.current) return;
    setNodes(nds => {
      const existingIds = new Set(nds.map(n => n.id));
      const newIdeas = ideias.filter(i => !existingIds.has(i.id));

      let updated = nds.map(n => {
        if (n.type !== 'ideaNode') return n;
        const ideia = ideias.find(i => i.id === n.id);
        if (!ideia) return n;
        return { ...n, data: { ...n.data, idea: ideia } };
      });

      if (newIdeas.length > 0) {
        const newIdeaNodes = buildIdeaNodes(newIdeas, new Map(), isReadOnly, stableCallbacks, visibleIdeaIds);
        updated = [...updated, ...newIdeaNodes];
      }
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideias]);

  // ─── 3. Atualiza visibilidade por filtros SEM alterar o layout salvo ────────

  useEffect(() => {
    if (!initializedRef.current) return;

    // Conjunto de todos os IDs de ideias cadastradas no sistema
    const allIdeaIds = new Set(ideias.map(i => i.id));

    setNodes(nds => nds.map(n => {
      if (n.type !== 'ideaNode') return n;
      const isHidden = visibleIdeaIds ? !visibleIdeaIds.has(n.id) : false;
      if (n.hidden === isHidden) return n;
      return { ...n, hidden: isHidden };
    }));

    setEdges(eds => eds.map(e => {
      // Uma extremidade só é considerada oculta se FOR UM CARTÃO DE IDEIA e esse cartão estiver filtrado.
      // Setas entre post-its livres (ou entre post-it e ideia visível) NUNCA são ocultadas pelo filtro de ideias!
      const sourceIsHiddenIdea = visibleIdeaIds ? (allIdeaIds.has(e.source) && !visibleIdeaIds.has(e.source)) : false;
      const targetIsHiddenIdea = visibleIdeaIds ? (allIdeaIds.has(e.target) && !visibleIdeaIds.has(e.target)) : false;
      const isHidden = sourceIsHiddenIdea || targetIsHiddenIdea;
      if (e.hidden === isHidden) return e;
      return { ...e, hidden: isHidden };
    }));
  }, [visibleIdeaIds, ideias]);

  // ─── 4. Atualiza modo de conexão nos nós sem re-hidratação de nós ───────────

  useEffect(() => {
    connectingModeRef.current = isConnectingMode;
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isConnectingMode,
        isConnectionSource: connectionSourceId === n.id,
      },
    })));
  }, [isConnectingMode, connectionSourceId]);

  // ─── 5. Salvamento Serializado com Controle Estrito de Versão ───────────────

  const triggerSave = useCallback((newNodes = null, newEdges = null) => {
    if (isReadOnly || !layoutLoadedRef.current || saveStatus === 'load_error' || saveStatus === 'conflict') return;
    setSaveStatus('pending');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    pendingSaveRef.current = {
      newNodes: newNodes ?? latestNodesRef.current,
      newEdges: newEdges ?? latestEdgesRef.current,
    };

    saveTimeoutRef.current = setTimeout(() => {
      executeSave();
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly, saveStatus]);

  const executeSave = useCallback(() => {
    if (isSavingRef.current) {
      // Já existe gravação em andamento: sinaliza pendência para a próxima rodada
      hasPendingChangesRef.current = true;
      return;
    }

    if (!layoutLoadedRef.current || isReadOnly) return;

    isSavingRef.current = true;
    hasPendingChangesRef.current = false;
    setSaveStatus('saving');
    setSaveError('');

    const resolvedNodes = pendingSaveRef.current?.newNodes ?? latestNodesRef.current;
    const resolvedEdges = pendingSaveRef.current?.newEdges ?? latestEdgesRef.current;
    pendingSaveRef.current = null;

    // Preserva TODOS os nós (mesmo os que estão com hidden: true devido a filtros)
    const cleanNodes = resolvedNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.type === 'noteNode'
        ? { text: n.data?.text || '', color: n.data?.color || 'yellow' }
        : n.type === 'textNode'
        ? { text: n.data?.text || '' }
        : {},
    }));

    const cleanEdges = resolvedEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type || 'smoothstep',
    }));

    const currentVersao = versionRef.current;

    onSaveLayout({ nodes: cleanNodes, edges: cleanEdges }, currentVersao)
      .then(res => {
        isSavingRef.current = false;

        if (res?.ok) {
          // Atualiza versão imediatamente para a próxima requisição
          const nextVersion = res.versao ?? (currentVersao + 1);
          versionRef.current = nextVersion;

          // Se houve novas edições enquanto salvava, dispara a próxima gravação
          if (hasPendingChangesRef.current) {
            hasPendingChangesRef.current = false;
            setSaveStatus('pending');
            setTimeout(executeSave, 150);
          } else {
            setSaveStatus('saved');
          }
        } else if (res?.conflict) {
          hasPendingChangesRef.current = false;
          setSaveStatus('conflict');
          setSaveError(res?.error?.message || 'A lousa foi alterada por outro usuário. Recarregue para mesclar.');
        } else {
          hasPendingChangesRef.current = false;
          setSaveStatus('error');
          setSaveError(res?.error?.message || 'Falha ao salvar lousa.');
        }
      })
      .catch(err => {
        isSavingRef.current = false;
        hasPendingChangesRef.current = false;
        setSaveStatus('error');
        setSaveError(err?.message || 'Erro inesperado ao salvar.');
      });
  }, [onSaveLayout, isReadOnly]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (layoutLoadedRef.current && !isReadOnly && pendingSaveRef.current) {
          executeSave();
        }
      }
    };
  }, [executeSave, isReadOnly]);

  // ─── 6. Handlers do ReactFlow ─────────────────────────────────────────────

  const onNodesChange = useCallback((changes) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDragStart = useCallback((_, node) => {
    dragStartPositionsRef.current.set(node.id, { ...node.position });
  }, []);

  const onNodeDragStop = useCallback((_, node) => {
    const startPos = dragStartPositionsRef.current.get(node.id);
    if (startPos && (startPos.x !== node.position.x || startPos.y !== node.position.y)) {
      undoStackRef.current.push({
        type: 'move_node',
        id: node.id,
        from: startPos,
        to: { ...node.position },
      });
      triggerSave();
    }
    dragStartPositionsRef.current.delete(node.id);
  }, [triggerSave]);

  const onEdgesChange = useCallback((changes) => {
    setEdges(eds => {
      const updated = applyEdgeChanges(changes, eds);
      const hasRemoval = changes.some(c => c.type === 'remove');
      if (hasRemoval) triggerSave(null, updated);
      return updated;
    });
  }, [triggerSave]);

  const onConnect = useCallback((connection) => {
    if (isReadOnly) return;
    const newEdge = {
      ...connection,
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      ...defaultEdgeOptions,
    };
    undoStackRef.current.push({ type: 'add_edge', edge: newEdge });
    const nextEdges = addEdge(newEdge, latestEdgesRef.current);
    setEdges(nextEdges);
    triggerSave(null, nextEdges);
  }, [isReadOnly, triggerSave]);

  // Intercepta tentativa de exclusão antes de remover do ReactFlow
  const onBeforeDelete = useCallback(async ({ nodes: toDeleteNodes, edges: toDeleteEdges }) => {
    if (isReadOnly) return false;

    // Se houver qualquer cartão de ideia selecionado, impede a exclusão no canvas
    // e abre modal de confirmação de arquivamento. Cancelar preserva tudo intacto.
    const ideaToDelete = toDeleteNodes.find(n => n.type === 'ideaNode');
    if (ideaToDelete) {
      const idea = ideias.find(i => i.id === ideaToDelete.id);
      if (idea) {
        setConfirmArchiveIdea(idea);
      }
      return false;
    }

    // Se for post-it ou texto:
    const customToDelete = toDeleteNodes.filter(n => n.type === 'noteNode' || n.type === 'textNode');
    if (customToDelete.length > 0) {
      customToDelete.forEach(n => handleDeleteCustomNode(n.id));
      return false;
    }

    // Se forem apenas setas:
    if (toDeleteEdges && toDeleteEdges.length > 0) {
      undoStackRef.current.push({ type: 'delete_edges', edges: toDeleteEdges });
      return true;
    }

    return true;
  }, [isReadOnly, ideias, handleDeleteCustomNode]);

  // ─── 7. Adicionar Nós Livres ──────────────────────────────────────────────

  const handleAddNote = (color = 'yellow') => {
    if (isReadOnly) return;
    const newId = `note-${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'noteNode',
      position: { x: 180 + Math.random() * 80, y: 140 + Math.random() * 60 },
      data: {
        text: '',
        color,
        isReadOnly,
        isConnectingMode,
        isConnectionSource: false,
        onNodeSelectForConnect: handleNodeSelectForConnect,
        onChangeText: handleNoteTextChange,
        onChangeColor: handleNoteColorChange,
        onDeleteNote: handleDeleteCustomNode,
      },
    };
    undoStackRef.current.push({ type: 'add_node', node: newNode });
    const nextNodes = [...latestNodesRef.current, newNode];
    setNodes(nextNodes);
    triggerSave(nextNodes, null);
  };

  const handleAddText = () => {
    if (isReadOnly) return;
    const newId = `text-${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'textNode',
      position: { x: 180 + Math.random() * 80, y: 140 + Math.random() * 60 },
      data: {
        text: 'Novo Tópico',
        isReadOnly,
        isConnectingMode,
        isConnectionSource: false,
        onNodeSelectForConnect: handleNodeSelectForConnect,
        onChangeText: handleNoteTextChange,
        onDeleteText: handleDeleteCustomNode,
      },
    };
    undoStackRef.current.push({ type: 'add_node', node: newNode });
    const nextNodes = [...latestNodesRef.current, newNode];
    setNodes(nextNodes);
    triggerSave(nextNodes, null);
  };

  // ─── 8. Desfazer (Undo) Confiável ──────────────────────────────────────────

  const handleUndo = () => {
    if (isReadOnly || undoStackRef.current.length === 0) return;
    const action = undoStackRef.current.pop();

    if (action.type === 'add_node') {
      const nextNodes = latestNodesRef.current.filter(n => n.id !== action.node.id);
      const nextEdges = latestEdgesRef.current.filter(
        e => e.source !== action.node.id && e.target !== action.node.id
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      triggerSave(nextNodes, nextEdges);
    } else if (action.type === 'delete_node') {
      const nextNodes = [...latestNodesRef.current, action.node];
      const restoredEdges = action.edges || [];
      const nextEdges = [...latestEdgesRef.current, ...restoredEdges];
      setNodes(nextNodes);
      setEdges(nextEdges);
      triggerSave(nextNodes, nextEdges);
    } else if (action.type === 'add_edge') {
      const nextEdges = latestEdgesRef.current.filter(e => e.id !== action.edge.id);
      setEdges(nextEdges);
      triggerSave(null, nextEdges);
    } else if (action.type === 'delete_edges') {
      const nextEdges = [...latestEdgesRef.current, ...(action.edges || [])];
      setEdges(nextEdges);
      triggerSave(null, nextEdges);
    } else if (action.type === 'move_node') {
      const nextNodes = latestNodesRef.current.map(n =>
        n.id === action.id ? { ...n, position: action.from } : n
      );
      setNodes(nextNodes);
      triggerSave(nextNodes, null);
    }
  };

  // ─── 9. Renderização ───────────────────────────────────────────────────────

  if (saveStatus === 'load_error') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 220px)', minHeight: 400, background: '#FEF2F2',
        borderRadius: 12, border: '1px solid #FECACA', gap: 12, padding: 24, textAlign: 'center',
      }}>
        <AlertTriangle style={{ width: 36, height: 36, color: '#DC2626' }} />
        <h4 style={{ margin: 0, fontSize: 16, color: '#991B1B', fontWeight: 700 }}>Erro ao carregar a lousa</h4>
        <p style={{ fontSize: 13, color: '#7F1D1D', maxWidth: 440, margin: 0, lineHeight: 1.5 }}>
          {saveError || 'Ocorreu um erro ao consultar o layout salvo. Por segurança, o salvamento automático está pausado.'}
        </p>
        <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>
          Verifique se a migração incremental foi aplicada no Supabase e tente recarregar a página.
        </p>
        <button className="btn btn-ghost" onClick={() => window.location.reload()} style={{ fontSize: 12 }}>
          Recarregar Página
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: 'calc(100vh - 220px)', minHeight: 520,
      position: 'relative', background: '#F8FAFC', borderRadius: 12,
      border: '1px solid var(--border-light)', overflow: 'hidden',
    }}>
      {/* Barra de Ferramentas */}
      <div style={{
        position: 'absolute', top: 12, left: 14, right: 14, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderRadius: 10, padding: '6px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-light)', flexWrap: 'wrap', gap: 8,
      }}>
        {/* Criação e Ferramentas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isReadOnly && (
            <>
              <button type="button" className="btn btn-primary"
                onClick={onNewIdeaQuick}
                style={{ padding: '6px 12px', fontSize: 12, background: '#8B5CF6', borderColor: '#8B5CF6' }}>
                <Plus style={{ width: 14, height: 14 }} /> Nova Ideia
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={() => handleAddNote('yellow')}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Adicionar post-it">
                <StickyNote style={{ width: 14, height: 14, color: '#D97706' }} /> Post-it
              </button>
              <button type="button" className="btn btn-ghost"
                onClick={handleAddText}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Adicionar texto livre">
                <Type style={{ width: 14, height: 14 }} /> Texto
              </button>
              <button type="button"
                className={`btn btn-ghost${isConnectingMode ? ' active' : ''}`}
                onClick={() => {
                  const next = !isConnectingMode;
                  connectingModeRef.current = next;
                  connectionSourceRef.current = null;
                  setConnectionSourceId(null);
                  setIsConnectingMode(next);
                }}
                style={{
                  padding: '6px 10px', fontSize: 12,
                  background: isConnectingMode ? '#EDE9FE' : 'transparent',
                  color: isConnectingMode ? '#7C3AED' : 'inherit',
                  borderColor: isConnectingMode ? '#8B5CF6' : 'transparent',
                }}
                title="Modo conectar: clique em dois elementos para ligá-los">
                <LinkIcon style={{ width: 14, height: 14 }} />
                {isConnectingMode
                  ? (connectionSourceId ? 'Selecione o destino' : 'Selecione a origem')
                  : 'Conectar'}
              </button>
            </>
          )}
          {onUsarModeloLive && !isReadOnly && (
            <button type="button" className="btn btn-ghost" onClick={onUsarModeloLive}
              style={{ padding: '6px 10px', fontSize: 12, color: '#7C3AED' }}
              title="Preencher modelo educativo de Live da Evelyn">
              <Sparkles style={{ width: 13, height: 13 }} /> Modelo Live
            </button>
          )}
        </div>

        {/* Controles de Visualização e Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isReadOnly && (
            <button type="button" className="btn btn-ghost" onClick={handleUndo}
              style={{ padding: 6 }} title="Desfazer última ação">
              <Undo style={{ width: 14, height: 14 }} />
            </button>
          )}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
            <button type="button" onClick={() => zoomIn()}
              style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer' }} title="Aumentar zoom">
              <ZoomIn style={{ width: 14, height: 14 }} />
            </button>
            <button type="button" onClick={() => zoomOut()}
              style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer' }} title="Diminuir zoom">
              <ZoomOut style={{ width: 14, height: 14 }} />
            </button>
            <button type="button" onClick={() => fitView({ padding: 0.2 })}
              style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer' }} title="Ajustar à tela">
              <Maximize2 style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Indicador de Status de Gravação */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
            padding: '3px 8px', borderRadius: 6, background: '#F8FAFC',
          }}>
            {(saveStatus === 'saved' || saveStatus === 'idle') && (
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                <Check style={{ width: 12, height: 12 }} /> Salvo
              </span>
            )}
            {saveStatus === 'saving' && (
              <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                <RefreshCw className="spin" style={{ width: 11, height: 11 }} /> Salvando...
              </span>
            )}
            {saveStatus === 'pending' && (
              <span style={{ color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                <Clock style={{ width: 11, height: 11 }} /> Alterações pendentes
              </span>
            )}
            {saveStatus === 'error' && (
              <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }} title={saveError}>
                <AlertCircle style={{ width: 12, height: 12 }} /> Erro ao salvar
              </span>
            )}
            {saveStatus === 'conflict' && (
              <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }} title={saveError}>
                <AlertTriangle style={{ width: 12, height: 12 }} /> Conflito — recarregue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lousa vazia */}
      {nodes.length === 0 && saveStatus !== 'load_error' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 5,
          textAlign: 'center', background: '#FFFFFF', padding: 24,
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          border: '1px solid var(--border-light)', maxWidth: 360,
        }}>
          <Sparkles style={{ width: 32, height: 32, color: '#8B5CF6', margin: '0 auto 10px' }} />
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Lousa de Ideias</h4>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Adicione uma ideia ou um post-it para começar seu planejamento visual.
          </p>
          {!isReadOnly && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={onNewIdeaQuick}
                style={{ background: '#8B5CF6', borderColor: '#8B5CF6', fontSize: 12 }}>
                <Plus style={{ width: 13, height: 13 }} /> Nova Ideia
              </button>
              {onUsarModeloLive && (
                <button className="btn btn-ghost" onClick={onUsarModeloLive}
                  style={{ fontSize: 12, color: '#7C3AED' }}>
                  Modelo Live
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Canvas ReactFlow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onBeforeDelete={onBeforeDelete}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={isReadOnly ? null : ['Delete', 'Backspace']}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly && !isConnectingMode}
        elementsSelectable
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#CBD5E1" gap={20} size={1} />
        <Controls showInteractive={false} style={{ bottom: 16, right: 16 }} />
      </ReactFlow>

      {/* Modal de Confirmação de Arquivamento */}
      {confirmArchiveIdea && (
        <div className="modal-overlay" onClick={() => setConfirmArchiveIdea(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Archive style={{ width: 18, height: 18, color: '#D97706' }} />
                <span className="modal-title">Arquivar Ideia</span>
              </div>
              <button className="modal-close" onClick={() => setConfirmArchiveIdea(null)}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.5, margin: '10px 0 16px' }}>
              Deseja arquivar a ideia <strong>&quot;{confirmArchiveIdea.titulo}&quot;</strong>?
              <br /><br />
              O registro, suas tarefas e histórico serão <strong>preservados</strong> e poderão ser restaurados pelo filtro de arquivadas.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-ghost"
                onClick={() => setConfirmArchiveIdea(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary"
                onClick={() => {
                  onArchiveIdea(confirmArchiveIdea.id);
                  setConfirmArchiveIdea(null);
                }}
                style={{ background: '#D97706', borderColor: '#D97706' }}>
                Confirmar Arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketingWhiteboard(props) {
  return (
    <ReactFlowProvider>
      <WhiteboardInner {...props} />
    </ReactFlowProvider>
  );
}
