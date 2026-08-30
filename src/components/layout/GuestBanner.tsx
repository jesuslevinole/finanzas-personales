import { CloudOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './GuestBanner.css';

/** Aviso permanente mientras la sesión sea anónima: los datos no viajan entre equipos. */
export default function GuestBanner() {
  const { isGuest, linkGoogle } = useAuth();
  if (!isGuest) return null;
  return (
    <div className="guestbanner">
      <CloudOff size={18} />
      <div className="grow">
        <p className="strong small">Sesión de invitado</p>
        <p className="tiny">Tus datos viven solo en este dispositivo. Entra con Google para verlos también en el teléfono.</p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={linkGoogle}>Entrar con Google</button>
    </div>
  );
}
