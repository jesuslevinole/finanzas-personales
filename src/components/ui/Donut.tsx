import type { CSSProperties } from 'react';
import './Donut.css';

interface Slice { color: string; share: number; }

interface Props {
  slices: Slice[];
  centerLabel: string;
  centerSub?: string;
}

/** Dona con conic-gradient calculado en runtime (valores vienen de datos). */
export default function Donut({ slices, centerLabel, centerSub }: Props) {
  let acc = 0;
  const stops = slices.map((s) => {
    const from = acc * 100;
    acc += s.share;
    return `${s.color} ${from}% ${acc * 100}%`;
  });
  if (acc < 1) stops.push(`var(--color-border) ${acc * 100}% 100%`);
  const gradient = stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(var(--color-border) 0 100%)';
  return (
    <div className="donut" style={{ '--donut-gradient': gradient } as CSSProperties}>
      <div className="donut-center">
        <span className="donut-label num">{centerLabel}</span>
        {centerSub && <span className="donut-sub">{centerSub}</span>}
      </div>
    </div>
  );
}
