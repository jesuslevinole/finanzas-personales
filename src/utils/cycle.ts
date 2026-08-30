import { addDays, daysBetween, todayIso } from './dates';

/**
 * Ciclo de pago: cobras los sábados y con eso cubres hasta el viernes siguiente.
 * Todo lo pendiente se agrupa contra esa ventana, no contra el mes calendario.
 */
export interface PayCycle {
  /** Sábado en que empieza (YYYY-MM-DD). */
  start: string;
  /** Viernes en que termina. */
  end: string;
  label: string;
}

const SATURDAY = 6;

const shift = addDays;

/** Sábado de la semana a la que pertenece la fecha (si es sábado, ese mismo día). */
export const cycleStart = (iso: string = todayIso()): string => {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return shift(iso, -((day - SATURDAY + 7) % 7));
};

export const cycleOf = (iso: string = todayIso()): PayCycle => {
  const start = cycleStart(iso);
  const end = shift(start, 6);
  return { start, end, label: `${labelDay(start)} – ${labelDay(end)}` };
};

export const nextCycle = (cycle: PayCycle): PayCycle => cycleOf(shift(cycle.start, 7));
export const prevCycle = (cycle: PayCycle): PayCycle => cycleOf(shift(cycle.start, -7));

export const inCycle = (iso: string, cycle: PayCycle): boolean => iso >= cycle.start && iso <= cycle.end;

/** Días que faltan para el próximo cobro (sábado). 0 si hoy es sábado. */
export const daysToPayday = (iso: string = todayIso()): number => {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return (SATURDAY - day + 7) % 7;
};

/** Fecha del costo fijo dentro de un mes, a partir de su día de pago. */
export const fixedCostDate = (month: string, dueDay: number): string =>
  `${month}-${String(Math.min(Math.max(dueDay, 1), 28)).padStart(2, '0')}`;

export const isOverdue = (iso: string, today: string = todayIso()): boolean => daysBetween(today, iso) < 0;

const labelDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
};
