import { useEffect, type ReactNode } from 'react';
import { useConfirm } from '../../hooks/useConfirm';
import { X } from 'lucide-react';
import './Modal.css';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Si es true, pregunta antes de cerrar (para formularios a medio llenar). */
  confirmOnClose?: boolean;
}

/** Modal centrado en escritorio, hoja deslizante desde abajo en móvil. */
export default function Modal({ title, open, onClose, children, confirmOnClose = true }: Props) {
  const confirm = useConfirm();

  const requestClose = async () => {
    if (!confirmOnClose) { onClose(); return; }
    const ok = await confirm({
      title: '¿Cerrar sin guardar?',
      message: 'Se perderá lo que hayas escrito en este formulario.',
      confirmLabel: 'Sí, cerrar',
      cancelLabel: 'Seguir editando',
      danger: true,
    });
    if (ok) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void requestClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => void requestClose()} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => void requestClose()} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
