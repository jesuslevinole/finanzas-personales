/**
 * Numeración visible de las tablas: 1, 2, 3… en orden de antigüedad.
 * No se guarda en Firestore (evita colisiones al escribir en paralelo); se
 * calcula al vuelo, así que el mismo registro siempre muestra el mismo número
 * mientras el criterio de orden no cambie.
 */
export const sequenceMap = <T extends { id: string }>(rows: T[], sortKey: (row: T) => string): Map<string, number> => {
  const ordered = [...rows].sort((a, b) => {
    const cmp = sortKey(a).localeCompare(sortKey(b));
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
  return new Map(ordered.map((row, i) => [row.id, i + 1]));
};

/** Columna «#» lista para usar en DataTable. */
export const seqOf = (map: Map<string, number>, id: string): number => map.get(id) ?? 0;

/** Ordena las filas por su número visible, del más alto al más bajo. */
export const sortBySeqDesc = <T extends { id: string }>(rows: T[], seq: Map<string, number>): T[] =>
  [...rows].sort((a, b) => (seq.get(b.id) ?? 0) - (seq.get(a.id) ?? 0));
