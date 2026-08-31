import type { Range } from '../../utils/range';
import './DateRange.css';

interface Props {
  value: Range;
  onChange: (range: Range) => void;
  label?: string;
}

/** Filtro de fechas: desde / hasta. Vacío significa «sin límite». */
export default function DateRange({ value, onChange, label = 'Rango de fechas' }: Props) {
  return (
    <div className="field daterange filterbar-wide">
      <span className="field-label">{label}</span>
      <div className="daterange-inputs">
        <input className="input" type="date" value={value.from} max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="Desde" />
        <span className="daterange-sep">a</span>
        <input className="input" type="date" value={value.to} min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="Hasta" />
      </div>
    </div>
  );
}

