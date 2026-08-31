/** Rango de fechas de los filtros: extremos vacíos significan «sin límite». */
export interface Range {
  from: string;
  to: string;
}

export const EMPTY_RANGE: Range = { from: '', to: '' };

export const inRange = (date: string, range: Range): boolean =>
  (!range.from || date >= range.from) && (!range.to || date <= range.to);

export const rangeActive = (range: Range): boolean => Boolean(range.from || range.to);
