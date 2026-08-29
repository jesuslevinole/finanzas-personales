import { useAuth } from '../hooks/useAuth';

/** Solo aparece si el acceso automático falló (proveedor anónimo deshabilitado, red, etc.). */
export default function Login() {
  const { login, error } = useAuth();
  return (
    <div className="splash">
      <div className="card login-card">
        <div className="brand">
          <span className="brand-mark">Bs</span>
          <div>
            <div className="brand-name">Bolívar Vivo</div>
            <div className="brand-tagline">Tus finanzas contra la inflación</div>
          </div>
        </div>
        <p className="muted small">No se pudo entrar automáticamente. Habilita el proveedor <strong>Anónimo</strong> en Firebase Authentication, o entra con Google.</p>
        {error && <p className="tiny text-danger">{error}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={login}>Entrar con Google</button>
      </div>
    </div>
  );
}
