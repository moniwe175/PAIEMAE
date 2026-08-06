import { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, X, GripVertical, Plus, StickyNote as StickyNoteIcon } from 'lucide-react';

const LANES = [
  { id: 'urgente', label: 'URGENTE', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: AlertOctagon },
  { id: 'medio', label: 'MEDIO', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle },
  { id: 'pouca', label: 'POUCA', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', icon: Info },
];

function StickyNote({ note, onDismiss, onDragStart, index }) {
  const rotation = index % 2 === 0 ? -1.2 : 1.2;
  return (
    <div
      draggable={!note.auto_generated}
      onDragStart={e => { if (!note.auto_generated) onDragStart(e, note); }}
      style={{
        background: '#FEF9C3',
        borderRadius: 6,
        padding: '10px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        transform: `rotate(${rotation}deg)`,
        cursor: note.auto_generated ? 'default' : 'grab',
        position: 'relative',
        borderLeft: `3px solid ${LANES.find(l => l.id === note.prioridade)?.color || '#F59E0B'}`,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = `rotate(0deg) scale(1.02)`; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = `rotate(${rotation}deg)`; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        {note.auto_generated && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 3 }}>
            <GripVertical style={{ width: 8, height: 8 }} />Automatico
          </div>
        )}
        {note.assignee && (
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280' }}>
            {note.assignee}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#1F2937', lineHeight: 1.4, marginBottom: 6 }}>{note.texto}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {note.source && (
          <span style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', background: '#F3F4F6', padding: '1px 6px', borderRadius: 99 }}>{note.source}</span>
        )}
        {/* OKR task notes: show date / "Atrasada" instead of X */}
        {note.okrTask ? (
          note.isOverdue ? (
            <span style={{
              fontSize: 9, fontWeight: 800, color: '#fff',
              background: '#EF4444', padding: '2px 7px', borderRadius: 99,
              letterSpacing: 0.3,
            }}>Atrasada</span>
          ) : note.dueDateStr ? (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#6B7280',
              background: '#F3F4F6', padding: '2px 7px', borderRadius: 99,
              letterSpacing: 0.3,
            }}>até {note.dueDateStr}</span>
          ) : null
        ) : (
          /* All other notes (stock + manual): keep the X button */
          <button
            onClick={e => { e.stopPropagation(); onDismiss(note); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center' }}
            title="Dispensar nota"
          >
            <X style={{ width: 12, height: 12, color: '#9CA3AF' }} />
          </button>
        )}
      </div>
    </div>
  );
}


function AddNoteInline({ laneId, onSave, onCancel }) {
  const [text, setText] = useState('');
  return (
    <div style={{ background: '#fff', border: '1.5px dashed #D1D5DB', borderRadius: 6, padding: 10 }}>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escreva a nota..."
        style={{ width: '100%', minHeight: 50, border: 'none', outline: 'none', resize: 'none', fontSize: 12, fontFamily: 'inherit', background: 'transparent' }}
      />
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}>Cancelar</button>
        <button onClick={() => { if (text.trim()) { onSave({ id: 'note_' + Date.now(), texto: text.trim(), prioridade: laneId, source: 'manual', auto_generated: false }); onCancel(); } }}
          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#1F2937', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Salvar</button>
      </div>
    </div>
  );
}

export default function StickyNotesPanel({ notes = [], onDismiss, onAdd, onMove }) {
  const [addingLane, setAddingLane] = useState(null);
  const [dragNote, setDragNote] = useState(null);

  const handleDrop = (e, laneId) => {
    e.preventDefault();
    if (dragNote && dragNote.prioridade !== laneId && !dragNote.auto_generated) {
      onMove?.(dragNote.id, laneId);
    }
    setDragNote(null);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <StickyNoteIcon style={{ width: 16, height: 16, color: '#F59E0B' }} />
        <span className="card-title" style={{ margin: 0 }}>Notas de Prioridade</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 'auto' }}>{notes.length} nota(s)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
        {LANES.map(lane => {
          const laneNotes = notes.filter(n => n.prioridade === lane.id);
          const LaneIcon = lane.icon;
          return (
            <div
              key={lane.id}
              style={{ borderRight: lane.id !== 'pouca' ? '1px solid var(--border-color)' : 'none', minHeight: 180 }}
              onDrop={e => handleDrop(e, lane.id)}
              onDragOver={e => e.preventDefault()}
            >
              {/* Lane header */}
              <div style={{ background: lane.bg, padding: '10px 14px', borderBottom: `2px solid ${lane.color}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LaneIcon style={{ width: 13, height: 13, color: lane.color }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: lane.color, letterSpacing: 0.5 }}>{lane.label}</span>
                <span style={{ background: lane.color, color: '#fff', borderRadius: 99, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{laneNotes.length}</span>
              </div>
              {/* Notes */}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {addingLane === lane.id && <AddNoteInline laneId={lane.id} onSave={onAdd} onCancel={() => setAddingLane(null)} />}
                {laneNotes.map((note, i) => (
                  <StickyNote key={note.id} note={note} index={i} onDismiss={onDismiss} onDragStart={(e, n) => setDragNote(n)} />
                ))}
                {laneNotes.length === 0 && addingLane !== lane.id && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#D1D5DB', fontSize: 11 }}>Nenhuma nota</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
