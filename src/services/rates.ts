import { todayIso } from '../utils/dates';

interface DolarApiResponse {
  promedio: number;
  fechaActualizacion: string;
}

const isDolarApiResponse = (v: unknown): v is DolarApiResponse =>
  typeof v === 'object' && v !== null && typeof (v as { promedio?: unknown }).promedio === 'number';

/** Tasa oficial BCV desde una API pública. Devuelve null si no hay red o la API cambia. */
export const fetchBcvRate = async (): Promise<{ date: string; rate: number } | null> => {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!isDolarApiResponse(json)) return null;
    return { date: todayIso(), rate: json.promedio };
  } catch {
    return null;
  }
};
