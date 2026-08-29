/** Utilidades de fechas en formato ISO local (YYYY-MM-DD / YYYY-MM). */

const pad = (n: number): string => String(n).padStart(2, '0');

export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const currentMonth = (): string => todayIso().slice(0, 7);

export const monthOf = (iso: string): string => iso.slice(0, 7);

export const addMonths = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
};

export const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
};

export const daysBetween = (fromIso: string, toIso: string): number => {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.round((b - a) / 86_400_000);
};
