/* eslint-disable react/prop-types */
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trash2, Palette } from 'lucide-react';

const COLORS = [
  { key: 'yellow', bg: '#FEF08A', border: '#FDE047', text: '#713F12' },
  { key: 'pink',   bg: '#FBCFE8', border: '#F472B6', text: '#831843' },
  { key: 'blue',   bg: '#BAE6FD', border: '#38BDF8', text: '#0C4A6E' },
  { key: 'green',  bg: '#BBF7D0', border: '#4ADE80', text: '#14532D' },
  { key: 'purple', bg: '#DDD6FE', border: '#A78BFA', text: '#4C1D95' },
  { key: 'orange', bg: '#FED7AA', border: '#FB923C', text: '#7C2D12' },
];

function MarketingNoteNodeComponent({ id, data, selected }) {
  const {
    text = '',
    color = 'yellow',
    isReadOnly = false,
    onChangeText,
    onChangeColor,
    onDeleteNote,
    isConnectingMode,
    isConnectionSource,
    onNodeSelectForConnect,
  } = data;

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorCfg = COLORS.find(c => c.key === color) || COLORS[0];

  return (
    <div
      onClick={(e) => {
        if (isConnectingMode && onNodeSelectForConnect) {
          e.stopPropagation();
          onNodeSelectForConnect(id, 'note');
        }
      }}
      style={{
        width: 190,
        minHeight: 140,
        background: colorCfg.bg,
        border: selected
          ? '2px solid #8B5CF6'
          : isConnectionSource
          ? '2px solid #2563EB'
          : `1px solid ${colorCfg.border}`,
        borderRadius: 8,
        boxShadow: selected
          ? '0 8px 24px rgba(139, 92, 246, 0.25)'
          : '0 4px 12px rgba(0, 0, 0, 0.08)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        color: colorCfg.text,
        position: 'relative',
        cursor: isConnectingMode ? 'crosshair' : 'grab',
      }}
    >
      {/* Handles nos 4 lados */}
      <Handle type="target" position={Position.Top} id="top" style={{ background: colorCfg.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: colorCfg.border, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: colorCfg.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: colorCfg.border, width: 8, height: 8 }} />

      {/* Barra de Ferramentas do Post-it */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}>
          Post-it
        </span>

        {!isReadOnly && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="nodrag"
              onClick={(e) => {
                e.stopPropagation();
                setColorPickerOpen(!colorPickerOpen);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: colorCfg.text }}
              title="Mudar cor"
            >
              <Palette style={{ width: 12, height: 12 }} />
            </button>
            <button
              type="button"
              className="nodrag"
              onClick={(e) => {
                e.stopPropagation();
                if (onDeleteNote) onDeleteNote(id);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#DC2626' }}
              title="Excluir nota"
            >
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}
      </div>

      {/* Paleta de Cores Popover */}
      {colorPickerOpen && !isReadOnly && (
        <div
          className="nodrag"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 28,
            right: 8,
            background: '#FFFFFF',
            borderRadius: 6,
            padding: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: 4,
            zIndex: 10,
          }}
        >
          {COLORS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                if (onChangeColor) onChangeColor(id, c.key);
                setColorPickerOpen(false);
              }}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: c.bg,
                border: `1px solid ${c.border}`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}

      {/* Textarea para anotação livre */}
      <textarea
        className="nodrag"
        disabled={isReadOnly}
        value={text}
        onChange={(e) => {
          if (onChangeText) onChangeText(id, e.target.value);
        }}
        placeholder="Escreva sua anotação..."
        rows={4}
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          background: 'transparent',
          resize: 'none',
          outline: 'none',
          fontSize: 12,
          lineHeight: 1.4,
          fontFamily: 'inherit',
          color: colorCfg.text,
        }}
      />
    </div>
  );
}

export default memo(MarketingNoteNodeComponent);
