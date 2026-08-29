import { useMemo, useState } from 'react';
import type { Debt, Expense, FixedCost, Income } from '../types';
import { addMonths, currentMonth, monthOf } from '../utils/dates';
import { useData } from '../hooks/useData';

/** Estado del mes seleccionado + datos filtrados a ese mes. */
export function useMonth() {
  const [month, setMonth] = useState(currentMonth());
  const { incomes, expenses, fixedCosts, debts } = useData();

  const data = useMemo(() => {
    const inMonth = (iso: string) => monthOf(iso) === month;
    const monthIncomes: Income[] = incomes.filter((i) => inMonth(i.date));
    const monthExpenses: Expense[] = expenses.filter((e) => inMonth(e.date));
    const monthFixed: FixedCost[] = fixedCosts.filter((f) => f.month === month);
    const monthDebts: Debt[] = debts.filter((d) => inMonth(d.dueDate));
    return { monthIncomes, monthExpenses, monthFixed, monthDebts };
  }, [month, incomes, expenses, fixedCosts, debts]);

  return {
    month,
    setMonth,
    prev: () => setMonth((m) => addMonths(m, -1)),
    next: () => setMonth((m) => addMonths(m, 1)),
    ...data,
  };
}
