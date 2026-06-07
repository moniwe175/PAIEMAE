import { useState, useEffect } from 'react';
import { ArrowRight, Save, RotateCw, Eye } from 'lucide-react';
import { useSync } from '../../contexts/SyncContext';
import useSheetSync from '../../hooks/useSheetSync';

const MAPPABLE_FIELDS = [
  { key: 'cliente', label: 'Cliente / Paciente', required: true },
  { key: 'procedimento', label: 'Procedimento / Serviço', required: true },
  { key: 'valor', label: 'Valor (R$)', required: true },
  { key: 'profissional', label: 'Profissional', required: false },
  { key: 'comissao', label: 'Comissão (%)', required: false },
  { key: 'data', label: 'Data', required: false },
  { key: 'tipo', label: 'Tipo (receita/despesa)', required: false },
  { key: 'categoria', label: 'Categoria', required: false },
];

const SAMPLE_HEADERS = ['Nome', 'Procedimento', 'Valor', 'Profissional', 'Comissão', 'Data', 'Tipo', 'Categoria'];

const SAMPLE_ROWS = [
  ['Ana Beatriz Souza', 'Botox Facial', 'R$ 650,00', 'Evelyn Costa', '40%', '14/05/2026', 'receita', 'Serviços'],
  ['Carla Mendes', 'Preenchimento Labial', '900', 'Juliana Ramos', '35%', '13/05/2026', 'receita', 'Serviços'],
  ['Fernanda Lima', 'Harmonização Facial', 'R$ 2.800,00', 'Evelyn Costa', '40%', '12/05/2026', 'receita', 'Pacotes'],
];

export default function ColumnMappingEditor() {
  const { syncConfig, setSyncConfig, addLog } = useSync();
  const { autoDetectMapping } = useSheetSync();

  const [mapping, setMapping] = useState(syncConfig.columnMapping || {});
  const [previewOpen, setPreviewOpen] = useState(false);

  // Use headers from config or sample
  const headers = syncConfig.sheetHeaders || SAMPLE_HEADERS;

  useEffect(() => {
    if (Object.keys(mapping).length === 0 && headers.length > 0) {
      const detected = autoDetectMapping(headers);
      setMapping(detected);
      addLog('info', 'Mapeamento de colunas detectado automaticamente');
    }
  }, []);

  const handleMappingChange = (fieldKey, colIndex) => {
    const newMapping = { ...mapping };
    if (colIndex === '') {
      delete newMapping[fieldKey];
    } else {
      newMapping[fieldKey] = parseInt(colIndex, 10);
    }
    setMapping(newMapping);
  };

  const handleSave = () => {
    setSyncConfig(prev => ({ ...prev, columnMapping: mapping }));
    addLog('success', 'Mapeamento de colunas salvo com sucesso');
  };

  const handleAutoDetect = () => {
    const detected = autoDetectMapping(headers);
    setMapping(detected);
    addLog('info', 'Mapeamento de colunas re-detectado');
  };

  const getPreviewValue = (rowIdx, fieldKey) => {
    const colIdx = mapping[fieldKey];
    if (colIdx === undefined || colIdx === null) return '-';
    const rows = syncConfig.sheetPreviewRows || SAMPLE_ROWS;
    return rows[rowIdx] ? rows[rowIdx][colIdx] || '-' : '-';
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <ArrowRight style={{ width: 16, height: 16 }} />
          Mapeamento de Colunas
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleAutoDetect}>
            <RotateCw style={{ width: 12, height: 12 }} />Auto-detectar
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save style={{ width: 12, height: 12 }} />Salvar
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Mapeie as colunas da sua planilha para os campos do ERP. Os campos obrigatórios estão marcados com *.
      </p>

      {/* Header preview */}
      <div style={{
        background: 'var(--bg-main)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        marginBottom: 14,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {headers.map((h, i) => (
          <span key={i} className="badge badge-neutral" style={{ fontSize: 11 }}>
            <strong style={{ color: 'var(--color-primary)', marginRight: 4 }}>{String.fromCharCode(65 + i)}</strong>
            {h}
          </span>
        ))}
      </div>

      {/* Mapping rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MAPPABLE_FIELDS.map(field => (
          <div key={field.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            background: mapping[field.key] !== undefined ? 'var(--success-bg)' : 'var(--bg-main)',
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.15s',
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>
                {field.label}
                {field.required && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
              </span>
            </div>

            <ArrowRight style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />

            <select
              className="form-select"
              style={{ width: 180 }}
              value={mapping[field.key] !== undefined ? mapping[field.key] : ''}
              onChange={e => handleMappingChange(field.key, e.target.value)}
            >
              <option value="">Não mapear</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {String.fromCharCode(65 + i)} - {h}
                </option>
              ))}
            </select>

            {mapping[field.key] !== undefined && (
              <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                OK
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Preview toggle */}
      <div style={{ marginTop: 14 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          <Eye style={{ width: 12, height: 12 }} />
          {previewOpen ? 'Ocultar Prévia' : 'Ver Prévia dos Dados'}
        </button>
      </div>

      {/* Preview table */}
      {previewOpen && (
        <div style={{ marginTop: 12, overflow: 'auto' }}>
          <table style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px' }}>Campo</th>
                <th style={{ padding: '6px 10px' }}>Linha 1</th>
                <th style={{ padding: '6px 10px' }}>Linha 2</th>
                <th style={{ padding: '6px 10px' }}>Linha 3</th>
              </tr>
            </thead>
            <tbody>
              {MAPPABLE_FIELDS.map(field => (
                <tr key={field.key}>
                  <td style={{ padding: '4px 10px', fontWeight: 600, fontSize: 11 }}>{field.label}</td>
                  <td style={{ padding: '4px 10px', fontSize: 11 }}>{getPreviewValue(0, field.key)}</td>
                  <td style={{ padding: '4px 10px', fontSize: 11 }}>{getPreviewValue(1, field.key)}</td>
                  <td style={{ padding: '4px 10px', fontSize: 11 }}>{getPreviewValue(2, field.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
