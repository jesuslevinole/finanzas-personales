import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import type { CatalogItem } from '../../types';
import { activeOnly } from '../../utils/relations';
import './CustomSelect.css';

interface Props<T extends CatalogItem> {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Si se pasa, permite crear un ítem nuevo escribiendo su nombre. */
  onCreate?: (name: string) => Promise<string>;
  disabled?: boolean;
}

/** Desplegable de catálogo con color, búsqueda y creación en línea. */
export default function CustomSelect<T extends CatalogItem>({ items, value, onChange, placeholder = 'Seleccionar…', onCreate, disabled }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const options = activeOnly(items).filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = items.find((i) => i.id === value);
  const exact = options.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(''); };

  const createItem = async () => {
    if (!onCreate || !query.trim() || creating) return;
    setCreating(true);
    try { pick(await onCreate(query.trim())); } finally { setCreating(false); }
  };

  return (
    <div className="cselect" ref={ref}>
      <button type="button" className={`cselect-trigger${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}>
        {selected ? (
          <>
            <span className="dot" style={{ '--dot-color': selected.color } as CSSProperties} />
            <span className="cselect-value truncate">{selected.name}</span>
          </>
        ) : (
          <span className="cselect-value cselect-placeholder truncate">{placeholder}</span>
        )}
        <ChevronDown size={16} className="cselect-chevron" />
      </button>

      {open && (
        <div className="cselect-panel" role="listbox">
          <div className="cselect-search">
            <Search size={14} />
            <input
              className="cselect-input" autoFocus value={query} placeholder="Buscar…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !exact && onCreate) { e.preventDefault(); void createItem(); } }}
            />
          </div>
          <ul className="cselect-list">
            {options.map((i) => (
              <li key={i.id}>
                <button type="button" className={`cselect-option${i.id === value ? ' selected' : ''}`} onClick={() => pick(i.id)} role="option" aria-selected={i.id === value}>
                  <span className="dot" style={{ '--dot-color': i.color } as CSSProperties} />
                  <span className="grow truncate">{i.name}</span>
                  {i.id === value && <Check size={14} />}
                </button>
              </li>
            ))}
            {options.length === 0 && !onCreate && <li className="cselect-empty">Sin resultados</li>}
          </ul>
          {onCreate && query.trim() && !exact && (
            <button type="button" className="cselect-create" onClick={createItem} disabled={creating}>
              <Plus size={14} /> Crear «{query.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}
