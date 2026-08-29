import type { ReactNode } from 'react';
import './DataTable.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Alineación de la celda. Los montos van a la derecha. */
  align?: 'start' | 'end';
  /** Ancho fijo de la columna en escritorio (ej. '96px'). */
  width?: string;
  /** En móvil, esta columna no se muestra. */
  hideOnMobile?: boolean;
  /** Columna principal: en móvil ocupa la primera línea de la tarjeta. */
  primary?: boolean;
}

interface Props<T extends { id: string }> {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  /** Botones al final de la fila (editar, eliminar…). */
  actions?: (row: T) => ReactNode;
  empty?: ReactNode;
  /** Clase extra por fila, para estados (vencida, pagada…). */
  rowClass?: (row: T) => string;
}

/**
 * Tabla en escritorio, tarjetas apiladas en móvil (misma definición de columnas).
 * La fila entera es clicable; los botones de acción detienen la propagación.
 */
export default function DataTable<T extends { id: string }>({ rows, columns, onRowClick, actions, empty, rowClass }: Props<T>) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="dt">
      <table className="dt-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`dt-th${c.align === 'end' ? ' end' : ''}${c.hideOnMobile ? ' hide-sm' : ''}`} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
            ))}
            {actions && <th className="dt-th dt-actions-th"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`dt-tr${onRowClick ? ' clickable' : ''}${rowClass ? ` ${rowClass(row)}` : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={`dt-td${c.align === 'end' ? ' end' : ''}${c.hideOnMobile ? ' hide-sm' : ''}${c.primary ? ' primary' : ''}`} data-label={c.header}>
                  {c.render(row)}
                </td>
              ))}
              {actions && (
                <td className="dt-td dt-actions" onClick={(e) => e.stopPropagation()}>
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
