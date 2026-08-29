import { formatBs, formatUsd, toBs, toUsd } from '../../utils/money';
import './Money.css';

interface Props {
  /** Monto en la moneda indicada por `currency`. */
  amount: number;
  currency: 'USD' | 'VES';
  rate?: number;
  /** Muestra la conversión a la otra moneda debajo. */
  dual?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Alinea a la izquierda (por defecto va alineado a la derecha, para columnas de monto). */
  align?: 'start' | 'end';
}

/** Monto con doble moneda: primaria grande, equivalente pequeño. */
export default function Money({ amount, currency, rate = 0, dual = false, size = 'md', align = 'end' }: Props) {
  const primary = currency === 'USD' ? formatUsd(amount) : formatBs(amount);
  const secondary = currency === 'USD' ? formatBs(toBs(amount, rate)) : formatUsd(toUsd(amount, rate));
  return (
    <span className={`money money-${size}${align === 'start' ? ' money-start' : ''}`}>
      <span className={`money-primary num ${currency === 'USD' ? 'text-usd' : 'text-bs'}`}>{primary}</span>
      {dual && rate > 0 && <span className="money-secondary num">{secondary}</span>}
    </span>
  );
}
