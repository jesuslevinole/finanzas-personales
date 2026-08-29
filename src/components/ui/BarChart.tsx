import type { CSSProperties } from 'react';
import './BarChart.css';

export interface Bar {
  label: string;
  value: number;
  /** Segunda barra de comparación (presupuesto, meta…). */
  compare?: number;
  color?: string;
}

interface Props {
  bars: Bar[];
  /** Formato de los valores (moneda, porcentaje…). */
  format: (n: number) => string;
  orientation?: 'horizontal' | 'vertical';
  compareLabel?: string;
  valueLabel?: string;
}

/**
 * Gráfica de barras en CSS puro: horizontal para rankings (rubros) y vertical
 * para series de tiempo. Los anchos son runtime, así que van por variable CSS.
 */
export default function BarChart({ bars, format, orientation = 'horizontal', compareLabel, valueLabel }: Props) {
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value, b.compare ?? 0)));

  if (orientation === 'vertical') {
    return (
      <div className="bc-vertical">
        {bars.map((b) => (
          <div key={b.label} className="bc-vcol">
            <span className="bc-vvalue num">{format(b.value)}</span>
            <div className="bc-vtrack">
              {b.compare !== undefined && <div className="bc-vbar compare" style={{ '--bar-h': `${(b.compare / max) * 100}%` } as CSSProperties} />}
              <div className="bc-vbar" style={{ '--bar-h': `${(b.value / max) * 100}%`, '--bar-color': b.color ?? 'var(--color-primary)' } as CSSProperties} />
            </div>
            <span className="bc-vlabel">{b.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bc">
      {(valueLabel || compareLabel) && (
        <div className="bc-legend tiny muted">
          {valueLabel && <span className="row"><span className="bc-swatch" /> {valueLabel}</span>}
          {compareLabel && <span className="row"><span className="bc-swatch compare" /> {compareLabel}</span>}
        </div>
      )}
      <ul className="bc-list">
        {bars.map((b) => {
          const over = b.compare !== undefined && b.value > b.compare;
          return (
            <li key={b.label} className="bc-row">
              <span className="bc-label truncate">{b.label}</span>
              <span className="bc-track">
                {b.compare !== undefined && (
                  <span className="bc-compare" style={{ '--bar-w': `${(b.compare / max) * 100}%` } as CSSProperties} />
                )}
                <span className={`bc-bar${over ? ' over' : ''}`} style={{ '--bar-w': `${(b.value / max) * 100}%`, '--bar-color': b.color ?? 'var(--color-primary)' } as CSSProperties} />
              </span>
              <span className="bc-value num">{format(b.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
