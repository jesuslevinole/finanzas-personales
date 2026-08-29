import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import './FilterBar.css';

interface Props {
  children: ReactNode;
  /** Cuántos filtros hay activos; si es 0 no se muestra el botón de limpiar. */
  activeCount: number;
  onClear: () => void;
}

/** En móvil los filtros van plegados: ocupan pantalla y casi nunca se usan de pie. */
export default function FilterBar({ children, activeCount, onClear }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="filterwrap">
      <button type="button" className="btn btn-outline filterwrap-toggle only-mobile" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <SlidersHorizontal size={16} /> Filtros{activeCount > 0 && <span className="tag primary">{activeCount}</span>}
      </button>
      <div className={`filterbar${open ? '' : ' collapsed'}`}>
        {children}
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost btn-sm filterbar-clear" onClick={onClear}>
            <X size={14} /> Limpiar ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}
