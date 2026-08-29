import { AlertTriangle, X } from 'lucide-react';
import { useData } from '../../hooks/useData';
import './WriteErrorToast.css';

/** Aviso flotante cuando una escritura a Firestore falla (red caída, permisos). */
export default function WriteErrorToast() {
  const { writeError, clearWriteError } = useData();
  if (!writeError) return null;
  return (
    <div className="wtoast" role="alert">
      <AlertTriangle size={18} />
      <div className="grow">
        <p className="strong small">No se pudo guardar</p>
        <p className="tiny">{writeError}</p>
        <p className="tiny">Revisa tu conexión y vuelve a intentarlo; el dato no se perdió del formulario.</p>
      </div>
      <button type="button" className="btn btn-ghost btn-icon" onClick={clearWriteError} aria-label="Cerrar aviso"><X size={16} /></button>
    </div>
  );
}
