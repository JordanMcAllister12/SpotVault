import { Minus, Plus, Maximize2 } from 'lucide-react';
import type { TableScaleMode } from '../lib/useTableScale';

interface Props {
  mode: TableScaleMode;
  scale: number;
  onStepUp: () => void;
  onStepDown: () => void;
  onReset: () => void;
}

const btnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
  background: 'rgba(255,255,255,0.03)',
  border: '1.5px solid rgba(255,255,255,0.08)',
  color: '#6b7280', transition: 'all 0.12s',
};

export function TableSizeControl({ mode, scale, onStepUp, onStepDown, onReset }: Props) {
  const pct = Math.round(scale * 100);
  const isAuto = mode === 'auto';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <button onClick={onStepDown} title="Smaller table" style={btnStyle}
        onMouseOver={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
        onMouseOut={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
        <Minus size={12} />
      </button>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 6, minWidth: 64, justifyContent: 'center',
        background: isAuto ? 'rgba(201,162,39,0.10)' : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${isAuto ? 'rgba(201,162,39,0.40)' : 'rgba(50,50,68,0.7)'}`,
        color: isAuto ? '#c9a227' : '#9ca3af',
        fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'default',
      }} title={isAuto ? 'Auto Fit — click +/− to set manual' : 'Manual zoom — click Reset for Auto Fit'}>
        <span style={{ fontSize: 8, letterSpacing: '0.06em', opacity: 0.7 }}>TABLE</span>
        <span style={{ color: isAuto ? '#d4af37' : '#e5e7eb', fontWeight: 800 }}>{pct}%</span>
      </div>
      <button onClick={onStepUp} title="Larger table" style={btnStyle}
        onMouseOver={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
        onMouseOut={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
        <Plus size={12} />
      </button>
      <button onClick={onReset} title="Auto Fit" style={{ ...btnStyle, width: 26 }}
        onMouseOver={e => { e.currentTarget.style.color = '#c9a227'; e.currentTarget.style.borderColor = 'rgba(201,162,39,0.4)'; }}
        onMouseOut={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
        <Maximize2 size={11} />
      </button>
    </div>
  );
}
