import type { ReactNode } from 'react';
import './StatCard.css';

type Tone = 'primary' | 'usd' | 'bs' | 'warn' | 'danger' | 'ok';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
}

export default function StatCard({ label, value, hint, icon, tone = 'primary' }: Props) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
