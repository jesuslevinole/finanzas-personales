import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './FilterBar.css';

interface Props {
  children: ReactNode;
  /** Cuántos filtros hay activos; si es 0 no se muestra el botón de limpiar. */
  activeCount: number;
  onClear: () => void;
}

export default function FilterBar({ children, activeCount, onClear }: Props) {
  return (
    <div className="filterbar">
      {children}
      {activeCount > 0 && (
        <button type="button" className="btn btn-ghost btn-sm filterbar-clear" onClick={onClear}>
          <X size={14} /> Limpiar ({activeCount})
        </button>
      )}
    </div>
  );
}
