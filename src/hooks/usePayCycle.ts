import { useMemo, useState } from 'react';
import type { Debt, FixedCost, ShoppingItem } from '../types';
import { cycleOf, fixedCostDate, type PayCycle } from '../utils/cycle';
import { todayIso } from '../utils/dates';
import { useData } from './useData';

export interface CycleDue {
  id: string;
  kind: 'deuda' | 'costo_fijo' | 'compra';
  title: string;
  subtitle: string;
  amountUsd: number;
  date: string;
  overdue: boolean;
  source: Debt | FixedCost | ShoppingItem;
}

/**
 * Todo lo que hay que pagar o comprar dentro de un ciclo de cobro (sábado a viernes),
 * más lo que ya venció y sigue abierto.
 */
const HORIZON_DAYS = 7;

const shiftIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function usePayCycle() {
  const { debts, fixedCosts, shopping, inventory } = useData();
  const today = todayIso();
  const [cycle] = useState<PayCycle>(cycleOf());
  const horizon = shiftIso(today, HORIZON_DAYS);

  const { dueThisCycle, overdue, upcoming } = useMemo(() => {
    const items: CycleDue[] = [];

    debts.filter((d) => d.status !== 'pagada').forEach((d) => items.push({
      id: `debt-${d.id}`, kind: 'deuda', title: d.merchant,
      subtitle: d.installment ? `Cuota ${d.installment}` : 'Cuota',
      amountUsd: d.amountUsd, date: d.dueDate, overdue: d.dueDate < today, source: d,
    }));

    fixedCosts.filter((f) => f.status !== 'pagada').forEach((f) => {
      const date = fixedCostDate(f.month, f.dueDay);
      items.push({
        id: `fixed-${f.id}`, kind: 'costo_fijo', title: f.description, subtitle: 'Costo fijo',
        amountUsd: f.amountUsd, date, overdue: date < today, source: f,
      });
    });

    shopping.filter((s) => !s.checked && s.priority === 'urgente').forEach((s) => items.push({
      id: `shop-${s.id}`, kind: 'compra', title: s.name, subtitle: 'Compra urgente',
      amountUsd: s.estimatedUsd * s.quantity, date: s.createdAt, overdue: false, source: s,
    }));

    const byDate = (a: CycleDue, b: CycleDue) => a.date.localeCompare(b.date);
    return {
      overdue: items.filter((i) => i.overdue).sort(byDate),
      // Solo lo que vence dentro de los próximos 7 días (las compras urgentes siempre entran).
      dueThisCycle: items.filter((i) => !i.overdue && (i.kind === 'compra' || (i.date >= today && i.date <= horizon))).sort(byDate),
      upcoming: items.filter((i) => !i.overdue && i.kind !== 'compra' && i.date > horizon).sort(byDate),
    };
  }, [debts, fixedCosts, shopping, today, horizon]);

  const lowStock = useMemo(() => inventory.filter((i) => i.quantity <= i.minQuantity), [inventory]);

  return {
    cycle,
    horizon,
    overdue,
    dueThisCycle,
    upcoming,
    lowStock,
  };
}
