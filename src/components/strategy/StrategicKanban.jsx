import { useState } from 'react';
import { Plus, XCircle, GripVertical, Target, Trash2 } from 'lucide-react';

const COLUNAS = [
  { id: 'todo', label: 'To Do', cor: '#6B7280', corBg: '#F9FAFB' },
  { id: 'in_progress', label: 'In Progress', cor: '#F59E0B', corBg: '#FFFBEB' },
  { id: 'done', label: 'Done', cor: '#10B981', corBg: '#ECFDF5' },
];

function TaskModal({ onClose, onSave, objetivos }) {
  const [form, setForm] = useState({ titulo: '', descricao: '', objetivo_id: '', responsavel: '', prioridade: 'medio' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canSave = form.titulo.trim();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Nova Tarefa Estrategica</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Titulo</label>
          <input className="form-input" placeholder="Ex: Implementar CRM" value={form.titulo} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Descricao</label>
          <textarea className="form-input" placeholder="Detalhes..." value={form.descricao} onChange={e => set('descricao', e.target.value)} style={{ minHeight: 60 }} />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Objetivo Vinculado</label>
            <select className="form-select" value={form.objetivo_id} onChange={e => set('objetivo_id', e.target.value)}>
              <option value="">Nenhum</option>
              {objetivos.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Responsavel</label>
            <input className="form-input" placeholder="Nome" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={() => { if (canSave) { onSave({ ...form, id: 'task_' + Date.now(), coluna: 'todo' }); onClose(); } }} style={{ opacity: canSave ? 1 : 0.5 }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function StrategicKanban({ tasks: initialTasks = [], objetivos = [], onAdd, onMove, onDelete }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dragging, setDragging] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Use external tasks if provided, otherwise internal state
  const activeTasks = initialTasks.length > 0 ? initialTasks : tasks;

  const moveCard = (cardId, novaCol) => {
    if (onMove) { onMove(cardId, novaCol); }
    else { setTasks(ts => ts.map(t => t.id === cardId ? { ...t, coluna: novaCol } : t)); }
  };

  const handleDelete = (id) => {
    if (onDelete) { onDelete(id); }
    else { setTasks(ts => ts.filter(t => t.id !== id)); }
  };

  return (
    <div>
      {showModal && <TaskModal onClose={() => setShowModal(false)} onSave={onAdd || (t => setTasks(ts => [...ts, t]))} objetivos={objetivos} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />Kanban Estrategico
        </h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus style={{ width: 12, height: 12 }} />Nova Tarefa</button>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUNAS.map(col => {
          const colTasks = activeTasks.filter(t => t.coluna === col.id);
          return (
            <div key={col.id} style={{ minWidth: 220, flex: 1 }}
              onDrop={e => { e.preventDefault(); if (dragging) moveCard(dragging.id, col.id); setDragging(null); }}
              onDragOver={e => e.preventDefault()}>
              <div style={{ background: col.corBg, borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.cor }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>{col.label}</span>
                  <span style={{ background: col.cor, color: '#fff', borderRadius: 99, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{colTasks.length}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                {colTasks.map(task => {
                  const obj = objetivos.find(o => o.id === task.objetivo_id);
                  return (
                    <div key={task.id} draggable onDragStart={e => { setDragging(task); e.dataTransfer.effectAllowed = 'move'; }}
                      className="card" style={{ cursor: 'grab', padding: '12px 14px', opacity: dragging?.id === task.id ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <GripVertical style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{task.titulo}</div>
                          {task.descricao && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{task.descricao}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {obj && <span style={{ fontSize: 9, background: 'var(--color-accent-soft)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>{obj.titulo.slice(0, 20)}...</span>}
                          {task.responsavel && <span style={{ fontSize: 9, background: '#F3F4F6', color: '#6B7280', padding: '1px 6px', borderRadius: 99 }}>{task.responsavel}</span>}
                        </div>
                        <button onClick={() => handleDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                          <Trash2 style={{ width: 12, height: 12, color: '#D1D5DB' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Arraste tarefas aqui</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
