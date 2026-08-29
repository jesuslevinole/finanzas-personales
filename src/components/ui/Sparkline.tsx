import './Sparkline.css';

interface Props {
  values: number[];
  height?: number;
  tone?: 'primary' | 'usd' | 'danger';
}

/** Línea de tendencia en SVG; los puntos se calculan en runtime. */
export default function Sparkline({ values, height = 48, tone = 'primary' }: Props) {
  if (values.length < 2) return <div className="sparkline-empty">Sin datos suficientes</div>;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - ((v - min) / span) * (height - 4) - 2}`);
  const d = `M${pts.join(' L')}`;
  return (
    <svg className={`sparkline ${tone}`} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="sparkline-area" d={`${d} L${w},${height} L0,${height} Z`} />
      <path className="sparkline-line" d={d} />
    </svg>
  );
}
