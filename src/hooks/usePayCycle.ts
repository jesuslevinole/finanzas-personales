import { useMemo, useState } from 'react';
import type { Debt, FixedCost, ShoppingItem } from '../types';
import { cycleOf, fixedCostDate, inCycle, nextCycle, prevCycle, type PayCycle } from '../utils/cycle';
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
export function usePayCycle() {
  const { debts, fixedCosts, shopping, inventory } = useData();
  const [cycle, setCycle] = useState<PayCycle>(cycleOf());
  const today = todayIso();

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
      dueThisCycle: items.filter((i) => !i.overdue && (i.kind === 'compra' || inCycle(i.date, cycle))).sort(byDate),
      upcoming: items.filter((i) => !i.overdue && i.kind !== 'compra' && i.date > cycle.end).sort(byDate),
    };
  }, [debts, fixedCosts, shopping, cycle, today]);

  const lowStock = useMemo(() => inventory.filter((i) => i.quantity <= i.minQuantity), [inventory]);

  return {
    cycle,
    goPrev: () => setCycle((c) => prevCycle(c)),
    goNext: () => setCycle((c) => nextCycle(c)),
    goCurrent: () => setCycle(cycleOf()),
    overdue,
    dueThisCycle,
    upcoming,
    lowStock,
  };
}
