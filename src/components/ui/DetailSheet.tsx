import type { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Modal from './Modal';
import './DetailSheet.css';

export interface DetailField {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  fields: DetailField[];
  onEdit?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}

/** Ficha de detalle de un registro, con acciones de editar y eliminar. */
export default function DetailSheet({ title, subtitle, open, onClose, fields, onEdit, onDelete, children }: Props) {
  return (
    <Modal title={title} open={open} onClose={onClose} confirmOnClose={false}>
      {subtitle && <p className="detail-subtitle">{subtitle}</p>}
      <dl className="detail-grid">
        {fields.map((f) => (
          <div key={f.label} className={`detail-field${f.wide ? ' wide' : ''}`}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      {(onEdit || onDelete) && (
        <div className="detail-actions">
          {onDelete && <button type="button" className="btn btn-danger" onClick={onDelete}><Trash2 size={16} /> Eliminar</button>}
          {onEdit && <button type="button" className="btn btn-primary" onClick={onEdit}><Pencil size={16} /> Editar</button>}
        </div>
      )}
    </Modal>
  );
}
