import { useCallback, useEffect, useState } from 'react';

const KEY = 'bolivar-vivo:current-place';
const EVENT = 'bolivar-vivo:place-changed';

const read = (): string => {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

/**
 * Dónde estás ahora mismo. Se guarda en el dispositivo (no en Firestore: es una
 * pista local, no un dato del espacio compartido) y precarga el lugar en los
 * formularios de gasto mientras estés en ese comercio.
 */
export function useCurrentPlace() {
  const [placeId, setPlaceId] = useState(read);

  // Varios componentes leen el mismo valor: se sincronizan con un evento propio.
  useEffect(() => {
    const sync = () => setPlaceId(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setPlace = useCallback((id: string) => {
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      // Sin almacenamiento simplemente no se recuerda entre sesiones.
    }
    setPlaceId(id);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { placeId, setPlace };
}
