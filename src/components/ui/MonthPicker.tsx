import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel } from '../../utils/dates';
import './MonthPicker.css';

interface Props { month: string; onPrev: () => void; onNext: () => void; }

export default function MonthPicker({ month, onPrev, onNext }: Props) {
  return (
    <div className="month-picker">
      <button type="button" className="btn btn-ghost btn-icon" onClick={onPrev} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
      <span className="month-picker-label">{monthLabel(month)}</span>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onNext} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
    </div>
  );
}
