import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
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
        <p className="muted small">Registra en bolívares, piensa en dólares. Cada movimiento se guarda con la tasa BCV del día para que la inflación no te oculte cuánto gastas de verdad.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={login}>Entrar con Google</button>
      </div>
    </div>
  );
}
