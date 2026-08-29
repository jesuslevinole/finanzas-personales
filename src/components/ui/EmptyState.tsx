import type { ReactNode } from 'react';
import './EmptyState.css';

interface Props { title: string; hint?: string; action?: ReactNode; }

export default function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint && <p className="small">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
