import type { CSSProperties } from 'react';

interface Props { ratio: number; color?: string; }

/** Barra con ancho y color de runtime vía variables CSS. */
export default function ProgressBar({ ratio, color }: Props) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const vars = { '--bar-width': `${pct}%`, ...(color ? { '--bar-color': color } : {}) } as CSSProperties;
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={vars} />
    </div>
  );
}
