import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConfirmContext, type ConfirmOptions } from './confirmContext';
import './ConfirmProvider.css';

/** Diálogo de confirmación propio, en vez del `confirm()` del navegador. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="confirm-backdrop" role="presentation" onClick={() => close(false)}>
          <div className="confirm" role="alertdialog" aria-modal="true" aria-label={options.title} onClick={(e) => e.stopPropagation()}>
            <span className={`confirm-icon${options.danger ? ' danger' : ''}`}><AlertTriangle size={20} /></span>
            <h2 className="confirm-title">{options.title}</h2>
            {options.message && <p className="confirm-message">{options.message}</p>}
            <div className="confirm-actions">
              <button type="button" className="btn btn-outline" onClick={() => close(false)}>{options.cancelLabel ?? 'Cancelar'}</button>
              <button type="button" className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>
                {options.confirmLabel ?? 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
