import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const KEY = 'bolivar-vivo:last-route';

/**
 * Recuerda la última vista. Si cierras la app o se recarga sola, vuelve donde
 * estabas en vez de mandarte al Resumen.
 */
export function useLastRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  // Restauración: solo una vez, y solo si se abrió en la raíz.
  useEffect(() => {
    if (location.pathname !== '/') return;
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && saved !== '/') navigate(saved, { replace: true });
    } catch {
      // Modo incógnito o almacenamiento bloqueado: se ignora.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, location.pathname);
    } catch {
      // Sin almacenamiento no se recuerda nada, pero la app sigue funcionando.
    }
  }, [location.pathname]);
}
