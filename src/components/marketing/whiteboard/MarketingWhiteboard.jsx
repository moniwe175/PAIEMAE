/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Maximize2, ZoomIn, ZoomOut, Save, AlertCircle, Check,
  Clock, Sparkles, Archive, Trash2, X, RefreshCw
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

function WhiteboardInner({
  ideias = [],
  isReadOnly = false,
  onOpenFicha,
  onNewIdeaQuick,
  onUsarModeloLive,
  onArchiveIdea,
  onApproveIdea,
  layoutData,
  layoutVersion,
  onSaveLayout,
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'pending' | 'error'
  const [saveError, setSaveError] = useState('');
  const [currentVersion, setCurrentVersion] = useState(layoutVersion || 1);

  // Modo conectar (especialmente útil para celular e toque)
  const [isConnectingMode, setIsConnectingMode] = useState(false);
  const [connectionSourceId, setConnectionSourceId] = useState(null);

  // Modal para confirmar arquivamento ao tentar remover cartão de ideia
  const [confirmArchiveIdea, setConfirmArchiveIdea] = useState(null);

  // Histórico local para Desfazer (Undo)
  const undoStackRef = useRef([]);
  const isInternalChangeRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  // Inicializa e sincroniza nós com a lista de ideias e o layout salvo
  useEffect(() => {
    const savedNodes = layoutData?.nodes || [];
    const savedEdges = layoutData?.edges || [];
    const savedNodesMap = new Map(savedNodes.map(n => [n.id, n]));

    const ideaNodes = ideias.map((ideia, idx) => {
      const existing = savedNodesMap.get(ideia.id);
      // Posição padrão em grade se não existir salva
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const defaultX = 80 + col * 310;
      const defaultY = 80 + row * 280;

      return {
        id: ideia.id,
        type: 'ideaNode',
        position: existing?.position || { x: defaultX, y: defaultY },
        data: {
          idea: ideia,
          isReadOnly,
          onOpenFicha,
          onApproveToggle: (i) => onApproveIdea(i.id, !i.aprovado),
          isConnectingMode,
          isConnectionSource: connectionSourceId === ideia.id,
          onNodeSelectForConnect: handleNodeSelectForConnect,
        },
      };
    });

    // Nós de post-it e texto livres salvos anteriormente
    const customNodes = savedNodes
      .filter(n => n.type === 'noteNode' || n.type === 'textNode')
      .map(n => ({
        ...n,
        data: {
          ...n.data,
          isReadOnly,
          isConnectingMode,
          isConnectionSource: connectionSourceId === n.id,
          onNodeSelectForConnect: handleNodeSelectForConnect,
          onChangeText: handleNoteTextChange,
          onChangeColor: handleNoteColorChange,
          onDeleteNote: handleDeleteCustomNode,
          onDeleteText: handleDeleteCustomNode,
        },
      }));

    setNodes([...ideaNodes, ...customNodes]);
    setEdges(savedEdges);
    setCurrentVersion(layoutVersion || 1);
  }, [ideias, layoutData, layoutVersion, isReadOnly, isConnectingMode, connectionSourceId]);

  // Função para acionar salvamento com debounce
  const triggerSave = useCallback((newNodes, newEdges) => {
    if (isReadOnly) return;
    setSaveStatus('pending');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      setSaveError('');

      // Salva apenas dados essenciais de layout (id, type, position, dados dos post-its/textos)
      const cleanNodes = (newNodes || nodes).map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.type === 'noteNode'
          ? { text: n.data.text, color: n.data.color }
          : n.type === 'textNode'
          ? { text: n.data.text }
          : {},
      }));

      const cleanEdges = (newEdges || edges).map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type || 'smoothstep',
      }));

      const res = await onSaveLayout(
        { nodes: cleanNodes, edges: cleanEdges },
        currentVersion
      );

      if (res?.ok) {
        setSaveStatus('saved');
        if (res.versao) setCurrentVersion(res.versao);
      } else {
        setSaveStatus('error');
        setSaveError(res?.error?.message || 'Falha ao salvar lousa.');
      }
    }, 900);
  }, [nodes, edges, isReadOnly, currentVersion, onSaveLayout]);

  // Mudanças de nós (mover, selecionar)
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      const hasPositionChange = changes.some(c => c.type === 'position' && c.dragging === false);
      if (hasPositionChange) {
        triggerSave(updated, edges);
      }
      return updated;
    });
  }, [edges, triggerSave]);

  // Mudanças de arestas
  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds);
      triggerSave(nodes, updated);
      return updated;
    });
  }, [nodes, triggerSave]);

  // Nova conexão arrastando alças
  const onConnect = useCallback((connection) => {
    if (isReadOnly) return;
    // Registra no histórico para Desfazer
    undoStackRef.current.push({ type: 'add_edge', edge: connection });

    setEdges((eds) => {
      const updated = addEdge({ ...connection, ...defaultEdgeOptions }, eds);
      triggerSave(nodes, updated);
      return updated;
    });
  }, [nodes, isReadOnly, triggerSave]);

  // Seleção de nós no modo toque / conexão rápida
  const handleNodeSelectForConnect = useCallback((nodeId) => {
    if (!isConnectingMode) return;
    if (!connectionSourceId) {
      setConnectionSourceId(nodeId);
    } else {
      if (connectionSourceId !== nodeId) {
        const newEdge = {
          id: `edge-${connectionSourceId}-${nodeId}-${Date.now()}`,
          source: connectionSourceId,
          target: nodeId,
          ...defaultEdgeOptions,
        };
        undoStackRef.current.push({ type: 'add_edge', edge: newEdge });
        setEdges(eds => {
          const updated = [...eds, newEdge];
          triggerSave(nodes, updated);
          return updated;
        });
      }
      setConnectionSourceId(null);
      setIsConnectingMode(false);
    }
  }, [isConnectingMode, connectionSourceId, nodes, triggerSave]);

  // Adicionar Post-it
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
        onChangeText: handleNoteTextChange,
        onChangeColor: handleNoteColorChange,
        onDeleteNote: handleDeleteCustomNode,
        isConnectingMode,
        onNodeSelectForConnect: handleNodeSelectForConnect,
      },
    };

    undoStackRef.current.push({ type: 'add_node', node: newNode });
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    triggerSave(updatedNodes, edges);
  };

  // Adicionar Texto Livre
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
        onChangeText: handleNoteTextChange,
        onDeleteText: handleDeleteCustomNode,
        isConnectingMode,
        onNodeSelectForConnect: handleNodeSelectForConnect,
      },
    };

    undoStackRef.current.push({ type: 'add_node', node: newNode });
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    triggerSave(updatedNodes, edges);
  };

  // Edição de texto em Post-it ou Texto
  const handleNoteTextChange = useCallback((id, newText) => {
    setNodes(nds => {
      const updated = nds.map(n => n.id === id ? { ...n, data: { ...n.data, text: newText } } : n);
      triggerSave(updated, edges);
      return updated;
    });
  }, [edges, triggerSave]);

  // Mudança de cor de Post-it
  const handleNoteColorChange = useCallback((id, newColor) => {
    setNodes(nds => {
      const updated = nds.map(n => n.id === id ? { ...n, data: { ...n.data, color: newColor } } : n);
      triggerSave(updated, edges);
      return updated;
    });
  }, [edges, triggerSave]);

  // Excluir Post-it ou Texto (com suporte a Desfazer)
  const handleDeleteCustomNode = useCallback((id) => {
    if (isReadOnly) return;
    setNodes(nds => {
      const target = nds.find(n => n.id === id);
      if (target) {
        undoStackRef.current.push({ type: 'delete_node', node: target });
      }
      const updatedNodes = nds.filter(n => n.id !== id);
      setEdges(eds => {
        const updatedEdges = eds.filter(e => e.source !== id && e.target !== id);
        triggerSave(updatedNodes, updatedEdges);
        return updatedEdges;
      });
      return updatedNodes;
    });
  }, [isReadOnly, triggerSave]);

  // Interceptação de deleção de nós via tecla Delete / Backspace
  const onNodesDelete = useCallback((deleted) => {
    for (const n of deleted) {
      if (n.type === 'ideaNode') {
        // Encontra a ideia correspondente e pede confirmação de arquivamento
        const idea = ideias.find(i => i.id === n.id);
        if (idea) {
          setConfirmArchiveIdea(idea);
        }
      } else {
        handleDeleteCustomNode(n.id);
      }
    }
  }, [ideias, handleDeleteCustomNode]);

  // Desfazer (Undo visual)
  const handleUndo = () => {
    if (isReadOnly || undoStackRef.current.length === 0) return;
    const action = undoStackRef.current.pop();
    if (action.type === 'add_node') {
      setNodes(nds => nds.filter(n => n.id !== action.node.id));
      setEdges(eds => eds.filter(e => e.source !== action.node.id && e.target !== action.node.id));
    } else if (action.type === 'delete_node') {
      setNodes(nds => [...nds, action.node]);
    } else if (action.type === 'add_edge') {
      setEdges(eds => eds.filter(e => e.id !== action.edge.id));
    }
    triggerSave();
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 220px)', minHeight: 520, position: 'relative', background: '#F8FAFC', borderRadius: 12, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
      {/* Barra de Ferramentas Compacta da Lousa */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 14,
          right: 14,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: 10,
          padding: '6px 12px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border-light)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Ferramentas de Criação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isReadOnly && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onNewIdeaQuick}
                style={{ padding: '6px 12px', fontSize: 12, background: '#8B5CF6', borderColor: '#8B5CF6' }}
              >
                <Plus style={{ width: 14, height: 14 }} /> Nova Ideia
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleAddNote('yellow')}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Adicionar post-it amarelo"
              >
                <StickyNote style={{ width: 14, height: 14, color: '#D97706' }} /> Post-it
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleAddText}
                style={{ padding: '6px 10px', fontSize: 12 }}
                title="Adicionar texto livre"
              >
                <Type style={{ width: 14, height: 14 }} /> Texto
              </button>

              <button
                type="button"
                className={`btn btn-ghost${isConnectingMode ? ' active' : ''}`}
                onClick={() => {
                  setIsConnectingMode(!isConnectingMode);
                  setConnectionSourceId(null);
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  background: isConnectingMode ? '#EDE9FE' : 'transparent',
                  color: isConnectingMode ? '#7C3AED' : 'inherit',
                  borderColor: isConnectingMode ? '#8B5CF6' : 'transparent',
                }}
                title="Modo conectar: clique em dois elementos para ligá-los"
              >
                <LinkIcon style={{ width: 14, height: 14 }} />
                {isConnectingMode ? (connectionSourceId ? 'Selecione o destino' : 'Selecione a origem') : 'Conectar'}
              </button>
            </>
          )}

          {onUsarModeloLive && !isReadOnly && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onUsarModeloLive}
              style={{ padding: '6px 10px', fontSize: 12, color: '#7C3AED' }}
              title="Preencher modelo educativo de Live da Evelyn"
            >
              <Sparkles style={{ width: 13, height: 13 }} /> Modelo Live
            </button>
          )}
        </div>

        {/* Controles de Visualização, Desfazer e Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isReadOnly && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleUndo}
              style={{ padding: 6 }}
              title="Desfazer alteração visual"
            >
              <Undo style={{ width: 14, height: 14 }} />
            </button>
          )}

          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
            <button
              type="button"
              onClick={() => zoomIn()}
              style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer' }}
              title="Aumentar zoom"
            >
              <ZoomIn style={{ width: 14, height: 14 }} />
            </button>
            <button
              type="button"
              onClick={() => zoomOut()}
              style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer' }}
              title="Diminuir zoom"
            >
              <ZoomOut style={{ width: 14, height: 14 }} />
            </button>
            <button
              type="button"
              onClick={() => fitView({ padding: 0.2 })}
              style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer' }}
              title="Ajustar à tela"
            >
              <Maximize2 style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Indicador de Status de Salvamento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#F8FAFC' }}>
            {saveStatus === 'saved' && (
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
          </div>
        </div>
      </div>

      {/* Instrução se a lousa estiver completamente vazia */}
      {nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 5,
            textAlign: 'center',
            background: '#FFFFFF',
            padding: 24,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            border: '1px solid var(--border-light)',
            maxWidth: 360,
          }}
        >
          <Sparkles style={{ width: 32, height: 32, color: '#8B5CF6', margin: '0 auto 10px' }} />
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Lousa de Ideias</h4>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Adicione uma ideia ou um post-it para começar a organizar seu planejamento visual.
          </p>
          {!isReadOnly && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={onNewIdeaQuick} style={{ background: '#8B5CF6', borderColor: '#8B5CF6', fontSize: 12 }}>
                <Plus style={{ width: 13, height: 13 }} /> Nova Ideia
              </button>
              {onUsarModeloLive && (
                <button className="btn btn-ghost" onClick={onUsarModeloLive} style={{ fontSize: 12, color: '#7C3AED' }}>
                  Modelo Live
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Canvas Interativo ReactFlow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={isReadOnly ? null : ['Delete', 'Backspace']}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={true}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#CBD5E1" gap={20} size={1} />
      </ReactFlow>

      {/* Modal de Confirmação para Arquivar Ideia (Preservação de Dados) */}
      {confirmArchiveIdea && (
        <div className="modal-overlay" onClick={() => setConfirmArchiveIdea(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Archive style={{ width: 18, height: 18, color: '#D97706' }} />
                <span className="modal-title">Arquivar Ideia</span>
              </div>
              <button className="modal-close" onClick={() => setConfirmArchiveIdea(null)}><X style={{ width: 18, height: 18 }} /></button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.5, margin: '10px 0 16px' }}>
              Deseja arquivar a ideia <strong>&quot;{confirmArchiveIdea.titulo}&quot;</strong>?
              <br /><br />
              O registro, suas tarefas, histórico e eventuais vínculos com campanhas serão <strong>preservados</strong> e poderão ser restaurados a qualquer momento pelo filtro de arquivadas.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmArchiveIdea(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onArchiveIdea(confirmArchiveIdea.id);
                  setConfirmArchiveIdea(null);
                }}
                style={{ background: '#D97706', borderColor: '#D97706' }}
              >
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
