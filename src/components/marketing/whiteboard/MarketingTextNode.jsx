/* eslint-disable react/prop-types */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

function MarketingTextNodeComponent({ id, data, selected }) {
  const {
    text = '',
    isReadOnly = false,
    onChangeText,
    onDeleteText,
    isConnectingMode,
    isConnectionSource,
    onNodeSelectForConnect,
  } = data;

  return (
    <div
      onClick={(e) => {
        if (isConnectingMode && onNodeSelectForConnect) {
          e.stopPropagation();
          onNodeSelectForConnect(id, 'text');
        }
      }}
      style={{
        minWidth: 160,
        maxWidth: 280,
        background: '#FFFFFF',
        border: selected
          ? '2px solid #8B5CF6'
          : isConnectionSource
          ? '2px solid #2563EB'
          : '1px dashed #CBD5E1',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: selected ? '0 4px 16px rgba(139, 92, 246, 0.2)' : '0 2px 6px rgba(0,0,0,0.04)',
        position: 'relative',
        cursor: isConnectingMode ? 'crosshair' : 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#94A3B8', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#94A3B8', width: 6, height: 6 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#94A3B8', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#94A3B8', width: 6, height: 6 }} />

      {!isReadOnly && (
        <button
          type="button"
          className="nodrag"
          onClick={(e) => {
            e.stopPropagation();
            if (onDeleteText) onDeleteText(id);
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: 2,
          }}
          title="Excluir texto"
        >
          <Trash2 style={{ width: 11, height: 11 }} />
        </button>
      )}

      <textarea
        className="nodrag"
        disabled={isReadOnly}
        value={text}
        onChange={(e) => {
          if (onChangeText) onChangeText(id, e.target.value);
        }}
        placeholder="Título ou texto organizador..."
        rows={2}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          resize: 'none',
          outline: 'none',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-dark)',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  );
}

export default memo(MarketingTextNodeComponent);
