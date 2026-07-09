import { useState, useMemo } from 'react';
import {
  Target, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle,
  Clock, TrendingUp, GripVertical, Plus, Calendar,
  Pencil, Trash2, X, Save
} from 'lucide-react';
import { useOKR } from '../contexts/OKRContext';
import './estrategia-styles.css';

// ─── COLUMN DEFINITIONS ─────────────────────────────────────────────────────────
const COLUMNS = [
  { id: 'todo', label: 'A Fazer', color: 'var(--text-muted)', bg: 'var(--bg-main)' },
  { id: 'doing', label: 'Em Andamento', color: 'var(--info)', bg: 'var(--info-bg)' },
  { id: 'done', label: 'Concluído', color: 'var(--success)', bg: 'var(--success-bg)' },
];

const ASSIGNEES = ['Evelyn', 'Gabriela', 'Barbara'];

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function getKRProgress(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  const done = tasks.filter(t => t.column === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

function getExpectedProgress(currentDay, totalDays) {
  return Math.round((currentDay / totalDays) * 100);
}

function getKRStatus(progress, expectedProgress) {
  if (progress >= expectedProgress) return { label: 'NO ALVO', className: 'badge-success', color: 'var(--success)' };
  if (progress >= expectedProgress * 0.7) return { label: 'ALERTA', className: 'badge-warning', color: 'var(--warning)' };
  return { label: 'CRÍTICO', className: 'badge-danger', color: 'var(--danger)' };
}

function getOverallHealth(allKRs, expectedProgress) {
  const onTarget = allKRs.filter(kr => {
    const progress = getKRProgress(kr.tasks);
    return progress >= expectedProgress;
  }).length;
  const ratio = onTarget / allKRs.length;
  if (ratio >= 0.7) return { label: 'Em Dia', className: 'badge-success', color: 'var(--success)' };
  if (ratio >= 0.4) return { label: 'Atenção', className: 'badge-warning', color: 'var(--warning)' };
  return { label: 'Crítico', className: 'badge-danger', color: 'var(--danger)' };
}

function getDueDateIndicator(dueDay, currentDay) {
  if (dueDay < currentDay) return { label: 'Atrasada', color: 'var(--danger)' };
  if (dueDay <= currentDay + 2) return { label: 'Hoje/Amanhã', color: 'var(--warning)' };
  return { label: `Dia ${dueDay}`, color: 'var(--text-muted)' };
}

// ─── OKR MODAL ──────────────────────────────────────────────────────────────────
function OKRModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md, 10px)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          width: '100%', maxWidth: 440,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '18px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Shared form field style
const fieldStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm, 6px)',
  fontSize: 13,
  color: 'var(--text-dark)',
  background: 'var(--bg-main)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em',
};

const btnRow = {
  display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18,
};

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 18px', background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm, 6px)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const btnSecondary = {
  padding: '8px 18px', background: 'var(--bg-main)', color: 'var(--text-dark)',
  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm, 6px)',
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
};

const btnDanger = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 18px', background: 'var(--danger)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm, 6px)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

// ─── ACTION BUTTON (icon-only) ──────────────────────────────────────────────────
function ActionBtn({ icon: Icon, onClick, color, title, size = 13 }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-main)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <Icon style={{ width: size, height: size, color }} />
    </button>
  );
}

// ─── MINI KANBAN COMPONENT ──────────────────────────────────────────────────────
function MiniKanban({ krId, tasks, onMoveTask, krStatus }) {
  const { currentDay, addTask, updateTask, deleteTask, selectedCycle } = useOKR();
  const isActive = selectedCycle?.is_active !== false;
  
  const [draggingId, setDraggingId] = useState(null);

  // Task modal state (edit only)
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', assignee: '', dueDay: 20 });

  // Inline new task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ title: '', assignee: '', dueDay: 20 });

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleDragStart = (e, taskId) => {
    if (!isActive) {
      e.preventDefault();
      return;
    }
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    if (!isActive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, columnId) => {
    if (!isActive) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onMoveTask(krId, taskId, columnId);
    }
    setDraggingId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const openNewTask = () => {
    if (!isActive) return;
    setNewTaskForm({ title: '', assignee: ASSIGNEES[0], dueDay: currentDay + 5 });
    setShowNewTask(true);
  };

  const saveNewTask = () => {
    if (!isActive) return;
    if (!newTaskForm.title.trim()) return;
    addTask(krId, newTaskForm);
    setNewTaskForm({ title: '', assignee: ASSIGNEES[0], dueDay: currentDay + 5 });
    setShowNewTask(false);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({ title: task.title, assignee: task.assignee || '', dueDay: task.dueDay || 20 });
    setTaskModalOpen(true);
  };

  const saveTask = () => {
    if (!taskForm.title.trim()) return;
    if (editingTask) {
      updateTask(krId, editingTask.id, taskForm);
    } else {
      addTask(krId, taskForm);
    }
    setTaskModalOpen(false);
  };

  const confirmDeleteTask = (taskId) => {
    deleteTask(krId, taskId);
    setDeleteConfirmId(null);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.column === col.id);
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {/* Column Header */}
              <div style={{
                background: col.bg,
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: `1px solid ${col.id === 'done' ? 'var(--success)' : col.id === 'doing' ? 'var(--info)' : 'var(--border-color)'}`,
                borderTopWidth: 2,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {col.label}
                </span>
                <span style={{
                  background: col.color,
                  color: '#fff',
                  borderRadius: 99,
                  width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700
                }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 60 }}>
                {colTasks.map(task => {
                  const dueInfo = getDueDateIndicator(task.dueDay, currentDay);
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderLeft: `3px solid ${krStatus.color}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 10px',
                        cursor: 'grab',
                        opacity: draggingId === task.id ? 0.4 : 1,
                        transition: 'opacity 0.15s, box-shadow 0.15s',
                        fontSize: 11,
                        position: 'relative',
                      }}
                    >
                      {/* Action buttons */}
                      {isActive && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          display: 'flex', gap: 1, opacity: 0.7,
                        }}>
                          <ActionBtn icon={Pencil} onClick={() => openEditTask(task)} color="var(--text-muted)" title="Editar tarefa" size={10} />
                          {deleteConfirmId === task.id ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); confirmDeleteTask(task.id); }}
                              style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 3, fontSize: 8, padding: '2px 5px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Sim
                            </button>
                          ) : (
                            <ActionBtn icon={Trash2} onClick={() => setDeleteConfirmId(task.id)} color="var(--danger)" title="Excluir tarefa" size={10} />
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <GripVertical style={{ width: 10, height: 10, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
                          <div style={{
                            fontWeight: 500,
                            color: col.id === 'done' ? 'var(--text-light)' : 'var(--text-dark)',
                            textDecoration: col.id === 'done' ? 'line-through' : 'none',
                            lineHeight: 1.3,
                            fontSize: 11,
                          }}>
                            {col.id === 'done' && <span style={{ marginRight: 3 }}>✓</span>}
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            {task.assignee && (
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>
                                {task.assignee}
                              </span>
                            )}
                            <span style={{ fontSize: 9, color: dueInfo.color, fontWeight: 600, marginLeft: 'auto' }}>
                              <Calendar style={{ width: 8, height: 8, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                              {dueInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div style={{
                    border: '1px dashed var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 8px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 10,
                  }}>
                    Arraste aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task — Inline */}
      {isActive && (
        !showNewTask ? (
          <button
            onClick={openNewTask}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 10, padding: '5px 0',
              background: 'none', border: 'none',
              fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
              cursor: 'pointer', transition: 'color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-light)'; }}
          >
            <Plus style={{ width: 13, height: 13 }} />
            Adicionar Tarefa
          </button>
        ) : (
          <div style={{
            marginTop: 10, padding: '12px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8,
          }}>
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <label style={{ ...labelStyle, marginBottom: 3 }}>Título</label>
              <input
                autoFocus
                style={{ ...fieldStyle, padding: '6px 10px', fontSize: 12 }}
                placeholder="Descreva a tarefa..."
                value={newTaskForm.title}
                onChange={e => setNewTaskForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 0 110px' }}>
              <label style={{ ...labelStyle, marginBottom: 3 }}>Responsável</label>
              <select
                style={{ ...fieldStyle, padding: '6px 10px', fontSize: 12 }}
                value={newTaskForm.assignee}
                onChange={e => setNewTaskForm(f => ({ ...f, assignee: e.target.value }))}
              >
                {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 0 70px' }}>
              <label style={{ ...labelStyle, marginBottom: 3 }}>Dia</label>
              <input
                type="number" min={1} max={31}
                style={{ ...fieldStyle, padding: '6px 10px', fontSize: 12 }}
                value={newTaskForm.dueDay}
                onChange={e => setNewTaskForm(f => ({ ...f, dueDay: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <button
                onClick={saveNewTask}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 14px', background: 'var(--color-primary)',
                  color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; }}
              >
                <Save style={{ width: 11, height: 11 }} /> Salvar
              </button>
              <button
                onClick={() => setShowNewTask(false)}
                style={{
                  padding: '6px 10px', background: 'none',
                  border: 'none', color: 'var(--text-muted)',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )
      )}

      {/* Task Edit Modal (kept for editing) */}
      <OKRModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Editar Tarefa"
      >
        <label style={labelStyle}>Título</label>
        <input
          style={{ ...fieldStyle, marginBottom: 12 }}
          value={taskForm.title}
          onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Descreva a tarefa..."
        />
        <label style={labelStyle}>Responsável</label>
        <select
          style={{ ...fieldStyle, marginBottom: 12 }}
          value={taskForm.assignee}
          onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))}
        >
          <option value="">Selecione...</option>
          {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={labelStyle}>Dia previsto</label>
        <input
          type="number" min={1} max={31}
          style={{ ...fieldStyle, marginBottom: 4 }}
          value={taskForm.dueDay}
          onChange={e => setTaskForm(f => ({ ...f, dueDay: parseInt(e.target.value) || 1 }))}
        />
        <div style={btnRow}>
          <button style={btnSecondary} onClick={() => setTaskModalOpen(false)}>Cancelar</button>
          <button style={btnPrimary} onClick={saveTask}>
            <Save style={{ width: 13, height: 13 }} />
            Salvar
          </button>
        </div>
      </OKRModal>

      {/* Delete Confirm */}
      <OKRModal
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirmar Exclusão"
      >
        <p style={{ fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.5 }}>
          Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
        </p>
        <div style={btnRow}>
          <button style={btnSecondary} onClick={() => setDeleteConfirmId(null)}>Cancelar</button>
          <button style={btnDanger} onClick={() => confirmDeleteTask(deleteConfirmId)}>
            <Trash2 style={{ width: 13, height: 13 }} />
            Excluir
          </button>
        </div>
      </OKRModal>
    </>
  );
}

// ─── KEY RESULT BLOCK ───────────────────────────────────────────────────────────
function KeyResultBlock({ objId, kr, expanded, onToggle, onMoveTask }) {
  const { currentDay, totalDays, updateKeyResult, deleteKeyResult, selectedCycle } = useOKR();
  const isActive = selectedCycle?.is_active !== false;
  const progress = getKRProgress(kr.tasks);
  const expectedProgress = isActive ? getExpectedProgress(currentDay, totalDays) : 100;
  const status = getKRStatus(progress, expectedProgress);
  const doneTasks = kr.tasks.filter(t => t.column === 'done').length;

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', target: '', unit: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openEdit = () => {
    setForm({ name: kr.name, target: String(kr.target || ''), unit: kr.unit || '' });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!form.name.trim()) return;
    updateKeyResult(objId, kr.id, { name: form.name, target: Number(form.target) || 0, unit: form.unit });
    setEditOpen(false);
  };

  return (
    <div style={{
      background: 'var(--bg-main)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-color)',
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      {/* KR Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', flex: 1, minWidth: 0 }}
        >
          {expanded
            ? <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-light)', flexShrink: 0 }} />
            : <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-light)', flexShrink: 0 }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dark)' }}>
              {kr.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {doneTasks}/{kr.tasks.length} tarefas concluídas
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: status.color }}>{progress}%</span>
          <span className={`badge ${status.className}`} style={{ fontSize: 9 }}>{status.label}</span>
          {isActive && (
            <>
              <ActionBtn icon={Pencil} onClick={openEdit} color="var(--text-muted)" title="Editar KR" />
              <ActionBtn icon={Trash2} onClick={() => setDeleteOpen(true)} color="var(--danger)" title="Excluir KR" />
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginTop: 8, position: 'relative' }}>
        <div style={{
          width: '100%', height: 5,
          background: 'var(--border-color)',
          borderRadius: 99, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(progress, 100)}%`,
            height: '100%',
            background: status.color,
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }} />
        </div>
        {/* Expected pace marker */}
        <div style={{
          position: 'absolute',
          left: `${expectedProgress}%`,
          top: -2,
          width: 2, height: 9,
          background: 'var(--text-dark)',
          borderRadius: 1,
          opacity: 0.4,
        }} />
      </div>

      {/* Expanded Mini-Kanban */}
      {expanded && (
        <MiniKanban
          krId={kr.id}
          tasks={kr.tasks}
          onMoveTask={onMoveTask}
          krStatus={status}
        />
      )}

      {/* Edit KR Modal */}
      <OKRModal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Key Result">
        <label style={labelStyle}>Nome do KR</label>
        <input style={{ ...fieldStyle, marginBottom: 12 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Meta</label>
            <input type="number" style={{ ...fieldStyle, marginBottom: 12 }} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Unidade</label>
            <input style={{ ...fieldStyle, marginBottom: 12 }} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="ex: %, R$, pacientes" />
          </div>
        </div>
        <div style={btnRow}>
          <button style={btnSecondary} onClick={() => setEditOpen(false)}>Cancelar</button>
          <button style={btnPrimary} onClick={saveEdit}><Save style={{ width: 13, height: 13 }} /> Salvar</button>
        </div>
      </OKRModal>

      {/* Delete KR Confirm */}
      <OKRModal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir Key Result">
        <p style={{ fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.5 }}>
          Tem certeza que deseja excluir <strong>"{kr.name}"</strong>?<br />
          Todas as {kr.tasks.length} tarefas vinculadas também serão excluídas.
        </p>
        <div style={btnRow}>
          <button style={btnSecondary} onClick={() => setDeleteOpen(false)}>Cancelar</button>
          <button style={btnDanger} onClick={() => { deleteKeyResult(objId, kr.id); setDeleteOpen(false); }}>
            <Trash2 style={{ width: 13, height: 13 }} /> Excluir
          </button>
        </div>
      </OKRModal>
    </div>
  );
}

// ─── OBJECTIVE BLOCK ────────────────────────────────────────────────────────────
function ObjectiveBlock({ objective, onMoveTask, expandedKRs, toggleKR }) {
  const { currentDay, totalDays, updateObjective, deleteObjective, addKeyResult, selectedCycle } = useOKR();
  const isActive = selectedCycle?.is_active !== false;
  const [expanded, setExpanded] = useState(false);
  const expectedProgress = isActive ? getExpectedProgress(currentDay, totalDays) : 100;

  const avgProgress = Math.round(
    objective.keyResults.reduce((sum, kr) => sum + getKRProgress(kr.tasks), 0) / (objective.keyResults.length || 1)
  );
  const overallStatus = getKRStatus(avgProgress, expectedProgress);
  const criticalKRs = objective.keyResults.filter(kr => {
    const p = getKRProgress(kr.tasks);
    return p < expectedProgress * 0.7;
  });

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ objective: '', owner: '' });

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Inline new KR form
  const [showNewKR, setShowNewKR] = useState(false);
  const [krForm, setKrForm] = useState({ name: '', valorAtual: 0, valorMeta: 0, unit: '' });

  const openEdit = () => {
    setEditForm({ objective: objective.objective, owner: objective.owner });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editForm.objective.trim()) return;
    updateObjective(objective.id, editForm);
    setEditOpen(false);
  };

  const saveNewKR = () => {
    if (!krForm.name.trim()) return;
    addKeyResult(objective.id, {
      name: krForm.name,
      target: Number(krForm.valorMeta) || 0,
      valorAtual: Number(krForm.valorAtual) || 0,
      unit: krForm.unit,
    });
    setKrForm({ name: '', valorAtual: 0, valorMeta: 0, unit: '' });
    setShowNewKR(false);
    setExpanded(true);
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* Objective Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          onClick={() => setExpanded(prev => !prev)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none', flex: 1, minWidth: 0 }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: expanded ? 'var(--color-primary)' : 'var(--color-accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}>
            <Target style={{ width: 18, height: 18, color: expanded ? '#fff' : 'var(--color-primary)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>
              {objective.objective}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
              Dono: {objective.owner} · {objective.keyResults.length} Key Results
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {criticalKRs.length > 0 && (
            <AlertTriangle style={{ width: 14, height: 14, color: 'var(--danger)' }} />
          )}
          <span className={`badge ${overallStatus.className}`}>{avgProgress}%</span>
          {isActive && (
            <>
              <ActionBtn icon={Pencil} onClick={openEdit} color="var(--text-muted)" title="Editar objetivo" />
              <ActionBtn icon={Trash2} onClick={() => setDeleteOpen(true)} color="var(--danger)" title="Excluir objetivo" />
            </>
          )}
          <div
            onClick={() => setExpanded(prev => !prev)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {expanded
              ? <ChevronDown style={{ width: 16, height: 16, color: 'var(--text-light)' }} />
              : <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-light)' }} />
            }
          </div>
        </div>
      </div>

      {/* Expanded Key Results */}
      {expanded && (
        <div style={{ marginTop: 16 }}>
          {criticalKRs.length > 0 && (
            <div style={{
              padding: '8px 12px',
              background: 'var(--danger-bg)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              color: 'var(--danger)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 10,
            }}>
              <AlertTriangle style={{ width: 13, height: 13 }} />
              {criticalKRs.length} KR{criticalKRs.length > 1 ? 's' : ''} em ritmo crítico — ação imediata necessária
            </div>
          )}
          {objective.keyResults.map(kr => (
            <KeyResultBlock
              key={kr.id}
              objId={objective.id}
              kr={kr}
              expanded={expandedKRs[kr.id] || false}
              onToggle={() => toggleKR(kr.id)}
              onMoveTask={onMoveTask}
            />
          ))}

          {/* Add KR — Inline ghost card */}
          {isActive && (
            !showNewKR ? (
              <button
                onClick={() => setShowNewKR(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  marginTop: 10, padding: '5px 0',
                  background: 'none', border: 'none',
                  fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
                  cursor: 'pointer', transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-light)'; }}
              >
                <Plus style={{ width: 13, height: 13 }} />
                Adicionar indicador de sucesso
              </button>
            ) : (
              <div style={{ marginTop: 8 }}>
                {/* Ghost card — mirrors KeyResultBlock design */}
                <div style={{
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  borderLeft: '3px solid var(--color-accent)',
                  padding: '14px 16px',
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Placeholder chevron */}
                    <ChevronRight style={{ width: 14, height: 14, color: 'var(--border-color)', flexShrink: 0 }} />

                    {/* Title input — invisible, underline only */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        autoFocus
                        style={{
                          width: '100%', background: 'transparent',
                          border: 'none', borderBottom: '1.5px solid var(--border-color)',
                          padding: '4px 0', fontSize: 12, fontWeight: 600,
                          color: 'var(--text-dark)', outline: 'none',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--color-primary)'; }}
                        onBlur={e => { e.currentTarget.style.borderBottomColor = 'var(--border-color)'; }}
                        placeholder="O que vamos medir? (Ex: Fechar novos pacotes premium)"
                        value={krForm.name}
                        onChange={e => setKrForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>

                    {/* Numeric pair: [Atual] / [Alvo] */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <input
                        type="number"
                        style={{
                          width: 54, textAlign: 'center',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 5, padding: '5px 2px',
                          fontSize: 12, fontWeight: 600,
                          color: 'var(--text-dark)', outline: 'none',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                        value={krForm.valorAtual}
                        onChange={e => setKrForm(f => ({ ...f, valorAtual: e.target.value }))}
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 300 }}>/</span>
                      <input
                        type="number"
                        style={{
                          width: 64, textAlign: 'center',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 5, padding: '5px 2px',
                          fontSize: 12, fontWeight: 700,
                          color: 'var(--color-primary)', outline: 'none',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                        placeholder="Ex: 15"
                        value={krForm.valorMeta}
                        onChange={e => setKrForm(f => ({ ...f, valorMeta: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Ghost progress bar — empty, decorative */}
                  <div style={{
                    marginTop: 10, width: '100%', height: 5,
                    background: 'var(--border-color)', borderRadius: 99,
                    opacity: 0.3,
                  }} />
                </div>

                {/* Action buttons — right-aligned */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 2px' }}>
                  <button
                    onClick={() => setShowNewKR(false)}
                    style={{
                      padding: '6px 14px', background: 'none',
                      border: 'none', color: 'var(--text-muted)',
                      fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveNewKR}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 16px', background: 'var(--color-primary)',
                      color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; }}
                  >
                    <Save style={{ width: 11, height: 11 }} /> Salvar
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Edit Objective Modal */}
      <OKRModal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Objetivo">
        <label style={labelStyle}>Objetivo</label>
        <input style={{ ...fieldStyle, marginBottom: 12 }} value={editForm.objective} onChange={e => setEditForm(f => ({ ...f, objective: e.target.value }))} />
        <label style={labelStyle}>Dono (Responsável)</label>
        <select style={{ ...fieldStyle, marginBottom: 4 }} value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))}>
          <option value="">Selecione...</option>
          {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={btnRow}>
          <button style={btnSecondary} onClick={() => setEditOpen(false)}>Cancelar</button>
          <button style={btnPrimary} onClick={saveEdit}><Save style={{ width: 13, height: 13 }} /> Salvar</button>
        </div>
      </OKRModal>

      {/* Delete Objective Confirm */}
      <OKRModal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir Objetivo">
        <p style={{ fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.5 }}>
          Tem certeza que deseja excluir <strong>"{objective.objective}"</strong>?<br />
          Todos os {objective.keyResults.length} Key Results e suas tarefas serão removidos.
        </p>
        <div style={btnRow}>
          <button style={btnSecondary} onClick={() => setDeleteOpen(false)}>Cancelar</button>
          <button style={btnDanger} onClick={() => { deleteObjective(objective.id); setDeleteOpen(false); }}>
            <Trash2 style={{ width: 13, height: 13 }} /> Excluir
          </button>
        </div>
      </OKRModal>


    </div>
  );
}

// ─── INSIGHTS PANEL ─────────────────────────────────────────────────────────────
function InsightsPanel({ allTasks, allKRs, expectedProgress }) {
  const { currentDay, totalDays, selectedCycle } = useOKR();
  const isActive = selectedCycle?.is_active !== false;

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.column === 'done').length;

  if (!isActive) {
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const missedKRs = allKRs
      .map(kr => ({ ...kr, progress: getKRProgress(kr.tasks) }))
      .filter(kr => kr.progress < 100)
      .sort((a, b) => b.progress - a.progress);

    return (
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>Relatório de Fechamento do Ciclo</span>
        </div>

        <div className="grid-2" style={{ gap: 12 }}>
          {/* Final Completion */}
          <div style={{
            background: 'var(--bg-main)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Conclusão Final
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: completionRate >= 80 ? 'var(--success)' : completionRate >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
              {completionRate}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
              Foram concluídas {doneTasks} de {totalTasks} tarefas no total.
            </div>
          </div>

          {/* Missed Targets */}
          <div style={{
            background: 'var(--bg-main)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Metas não atingidas ({missedKRs.length})
            </div>
            {missedKRs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 14, height: 14 }} />
                Todas as metas foram concluídas!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {missedKRs.slice(0, 3).map((kr, i) => (
                  <div key={kr.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--danger-bg)', color: 'var(--danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dark)', fontWeight: 500 }}>
                      {kr.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600, marginLeft: 'auto' }}>
                      {kr.progress}%
                    </span>
                  </div>
                ))}
                {missedKRs.length > 3 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    + {missedKRs.length - 3} outros KRs não concluídos
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const daysRemaining = totalDays - currentDay;

  // Velocity: tasks done per day so far
  const velocity = currentDay > 0 ? doneTasks / currentDay : 0;
  const projectedCompletion = totalTasks > 0
    ? Math.min(Math.round(((velocity * totalDays) / totalTasks) * 100), 100)
    : 0;

  // Critical KRs for priority actions
  const criticalKRs = allKRs
    .map(kr => ({ ...kr, progress: getKRProgress(kr.tasks) }))
    .filter(kr => kr.progress < expectedProgress * 0.7)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 3);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TrendingUp style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>Projeção & Insights do Mês</span>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        {/* Projection */}
        <div style={{
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Projeção de Conclusão
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: projectedCompletion >= 80 ? 'var(--success)' : projectedCompletion >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
            {projectedCompletion}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
            Se manter este ritmo, você atinge {projectedCompletion}% da meta até o final do mês
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Velocidade: {velocity.toFixed(1)} tarefas/dia · {daysRemaining} dias restantes
          </div>
        </div>

        {/* Priority Actions */}
        <div style={{
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ações Prioritárias
          </div>
          {criticalKRs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} />
              Todos os KRs estão no ritmo esperado!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {criticalKRs.map((kr, i) => (
                <div key={kr.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--danger-bg)', color: 'var(--danger)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dark)', fontWeight: 500 }}>
                    {kr.name}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600, marginLeft: 'auto' }}>
                    {kr.progress}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────────────────────
export default function Estrategia() {
  const { 
    okrData, loading, cycles, selectedCycle, setSelectedCycle, 
    moveTask, addTask, updateTask, deleteTask, addKeyResult, updateKeyResult, 
    currentDay, totalDays, currentMonth 
  } = useOKR();
  const [expandedKRs, setExpandedKRs] = useState({});

  // Inline new Objective form
  const [showNewObj, setShowNewObj] = useState(false);
  const [objForm, setObjForm] = useState({ objective: '', owner: '' });

  const toggleKR = (krId) => {
    setExpandedKRs(prev => ({ ...prev, [krId]: !prev[krId] }));
  };

  const saveNewObj = () => {
    if (!objForm.objective.trim()) return;
    addObjective(objForm);
    setObjForm({ objective: '', owner: '' });
    setShowNewObj(false);
  };

  // ─── Computed Metrics ───────────────────────────────────────────
  const allKRs = useMemo(() => okrData.flatMap(o => o.keyResults), [okrData]);
  const allTasks = useMemo(() => allKRs.flatMap(kr => kr.tasks), [allKRs]);
  
  const isActive = selectedCycle?.is_active !== false;
  const expectedProgress = isActive ? getExpectedProgress(currentDay, totalDays) : 100;

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.column === 'done').length;
  const taskProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const krsOnTarget = allKRs.filter(kr => getKRProgress(kr.tasks) >= expectedProgress).length;
  const krsAlert = allKRs.filter(kr => {
    const p = getKRProgress(kr.tasks);
    return p < expectedProgress * 0.7;
  }).length;

  const overallHealth = allKRs.length > 0
    ? getOverallHealth(allKRs, expectedProgress)
    : { label: 'Sem dados', className: 'badge-warning', color: 'var(--warning)' };

  // Pace calculation
  const paceRatio = expectedProgress > 0 ? Math.round((taskProgress / expectedProgress) * 100) : 100;
  const paceLabel = paceRatio >= 100 ? 'No ritmo!' : paceRatio >= 80 ? 'Levemente atrasado' : paceRatio >= 60 ? 'Atrasado' : 'Muito atrasado';

  const daysElapsed = currentDay;
  const daysRemaining = totalDays - currentDay;

  return (
    <div>
      {/* ═══ SECTION 1: Monthly Header ═══ */}
      <div className="page-header">
        <div className="page-header-label">
          <Target />
          ESTRATÉGIA OKR
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 2 }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                {cycles?.length > 0 ? (
                  <select
                    value={selectedCycle?.id || ''}
                    onChange={e => setSelectedCycle(cycles.find(c => c.id === e.target.value))}
                    style={{
                      background: 'transparent', border: 'none', fontSize: 'inherit',
                      fontWeight: 'inherit', color: 'inherit', cursor: 'pointer', outline: 'none'
                    }}
                  >
                    {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : currentMonth}
              </h1>
              {selectedCycle && !selectedCycle.is_active && (
                <span className="badge" style={{ background: '#F1C40F22', color: '#D4AC0D', fontSize: 11 }}>
                  Relatório Fechado
                </span>
              )}
            </div>
            {selectedCycle?.is_active ? (
              <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Clock style={{ width: 13, height: 13 }} />
                Dia {daysElapsed} de {totalDays} — {daysRemaining} dias restantes
              </p>
            ) : (
              <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Calendar style={{ width: 13, height: 13 }} />
                Ciclo encerrado. Visualizando histórico.
              </p>
            )}
          </div>
          <span className={`badge ${overallHealth.className}`} style={{ fontSize: 12, padding: '5px 14px' }}>
            {overallHealth.label}
          </span>
        </div>
        {/* Month progress bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{
            width: '100%', height: 8,
            background: 'var(--border-color)',
            borderRadius: 99, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.round((daysElapsed / totalDays) * 100)}%`,
              height: '100%',
              background: 'var(--color-primary)',
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Início do mês</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
              {Math.round((daysElapsed / totalDays) * 100)}% do mês decorrido
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Fim do mês</span>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 2: Smart Summary Cards ═══ */}
      <div className="grid-4 section-gap">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--info-bg)' }}>
            <TrendingUp style={{ color: 'var(--info)' }} />
          </div>
          <div className="stat-value">{taskProgress}%</div>
          <div className="stat-label">Ritmo Geral</div>
          <div className="stat-sub" style={{ color: paceRatio >= 100 ? 'var(--success)' : paceRatio >= 80 ? 'var(--warning)' : 'var(--danger)', fontWeight: 600 }}>
            {paceLabel} (esperado: {expectedProgress}%)
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--color-accent-soft)' }}>
            <CheckCircle2 style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="stat-value">{doneTasks}/{totalTasks}</div>
          <div className="stat-label">Tarefas do Mês</div>
          <div className="stat-sub">concluídas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--success-bg)' }}>
            <Target style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value">{krsOnTarget}/{allKRs.length}</div>
          <div className="stat-label">KRs no Alvo</div>
          <div className="stat-sub">≥ ritmo esperado</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--danger-bg)' }}>
            <AlertTriangle style={{ color: 'var(--danger)' }} />
          </div>
          <div className="stat-value">{krsAlert}</div>
          <div className="stat-label">Alertas Críticos</div>
          <div className="stat-sub">abaixo de 40% do ritmo</div>
        </div>
      </div>

      {/* ═══ SECTION 3: OKR Tree with Integrated Kanban ═══ */}
      <div>
        {okrData.map(obj => (
          <ObjectiveBlock
            key={obj.id}
            objective={obj}
            onMoveTask={moveTask}
            expandedKRs={expandedKRs}
            toggleKR={toggleKR}
          />
        ))}

        {/* Add New Objective — Inline */}
        {selectedCycle?.is_active !== false && (
          !showNewObj ? (
            <button
              onClick={() => setShowNewObj(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                marginTop: 12, padding: '6px 0',
                background: 'none', border: 'none',
                fontSize: 12, fontWeight: 500, color: 'var(--text-light)',
                cursor: 'pointer', transition: 'color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-light)'; }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Novo Objetivo
            </button>
          ) : (
            <div style={{
              marginTop: 12, padding: '16px 18px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10,
            }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <label style={{ ...labelStyle, marginBottom: 3 }}>Objetivo</label>
                <input
                  autoFocus
                  style={{ ...fieldStyle, padding: '7px 10px', fontSize: 12 }}
                  placeholder="ex: Aumentar faturamento em 30%"
                  value={objForm.objective}
                  onChange={e => setObjForm(f => ({ ...f, objective: e.target.value }))}
                />
              </div>
              <div style={{ flex: '0 0 130px' }}>
                <label style={{ ...labelStyle, marginBottom: 3 }}>Responsável</label>
                <select
                  style={{ ...fieldStyle, padding: '7px 10px', fontSize: 12 }}
                  value={objForm.owner}
                  onChange={e => setObjForm(f => ({ ...f, owner: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <button
                  onClick={saveNewObj}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '7px 16px', background: 'var(--color-primary)',
                    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary)'; }}
                >
                  <Save style={{ width: 11, height: 11 }} /> Salvar
                </button>
                <button
                  onClick={() => setShowNewObj(false)}
                  style={{
                    padding: '7px 10px', background: 'none',
                    border: 'none', color: 'var(--text-muted)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* ═══ SECTION 4: Monthly Insights Panel ═══ */}
      {allKRs.length > 0 && (
        <InsightsPanel
          allTasks={allTasks}
          allKRs={allKRs}
          expectedProgress={expectedProgress}
        />
      )}


    </div>
  );
}
