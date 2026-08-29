import type { Budget, BudgetGroup, Category, Debt, Expense, ExchangeRate, FixedCost, Income, InventoryItem, UserSettings } from '../types';
import { daysBetween } from './dates';
import { sum } from './money';

export const DEFAULT_SETTINGS: Omit<UserSettings, 'id'> = {
  maxDebtRatioPct: 35,
  emergencyFundMonths: 3,
  split: { necesidad: 50, deseo: 30, ahorro: 20 },
};

export const GROUP_LABEL: Record<BudgetGroup, string> = {
  necesidad: 'Necesidades',
  deseo: 'Deseos',
  ahorro: 'Ahorro y deuda',
};

/** Ingreso propio del mes (excluye dinero de terceros que solo pasa por la cuenta). */
export const ownIncomeUsd = (incomes: Income[]): number =>
  sum(incomes.filter((i) => i.owner === 'propio').map((i) => i.amountUsd));

export const expensesByCategory = (expenses: Expense[], categories: Category[]) => {
  const total = sum(expenses.map((e) => e.totalUsd));
  const map = new Map<string, number>();
  expenses.forEach((e) => map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.totalUsd));
  return [...map.entries()]
    .map(([categoryId, usd]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? '#9ca3af',
        group: cat?.group ?? 'necesidad',
        usd,
        share: total > 0 ? usd / total : 0,
      };
    })
    .sort((a, b) => b.usd - a.usd);
};

export const expensesByGroup = (expenses: Expense[], categories: Category[]): Record<BudgetGroup, number> => {
  const acc: Record<BudgetGroup, number> = { necesidad: 0, deseo: 0, ahorro: 0 };
  expenses.forEach((e) => {
    const g = categories.find((c) => c.id === e.categoryId)?.group ?? 'necesidad';
    acc[g] += e.totalUsd;
  });
  return acc;
};

export interface DebtCapacity {
  incomeUsd: number;
  monthlyDebtUsd: number;
  fixedCostsUsd: number;
  maxDebtUsd: number;
  availableUsd: number;
  ratio: number;
  level: 'sano' | 'alerta' | 'critico';
}

/**
 * Capacidad de endeudamiento: el servicio de deuda (cuotas del mes) no debería
 * superar `maxDebtRatioPct` del ingreso propio. Lo que sobra es lo que aún podrías
 * comprometer en cuotas nuevas (Cashea, préstamos, etc.).
 */
export const debtCapacity = (
  incomeUsd: number,
  debtsThisMonth: Debt[],
  fixedCosts: FixedCost[],
  settings: Omit<UserSettings, 'id'>,
): DebtCapacity => {
  const monthlyDebtUsd = sum(debtsThisMonth.filter((d) => d.owner === 'propio').map((d) => d.amountUsd));
  const fixedCostsUsd = sum(fixedCosts.map((f) => f.amountUsd));
  const maxDebtUsd = incomeUsd * (settings.maxDebtRatioPct / 100);
  const ratio = incomeUsd > 0 ? monthlyDebtUsd / incomeUsd : 0;
  const level: DebtCapacity['level'] = ratio < 0.25 ? 'sano' : ratio < settings.maxDebtRatioPct / 100 ? 'alerta' : 'critico';
  return {
    incomeUsd,
    monthlyDebtUsd,
    fixedCostsUsd,
    maxDebtUsd,
    availableUsd: Math.max(0, maxDebtUsd - monthlyDebtUsd),
    ratio,
    level,
  };
};

export interface GroupTarget {
  group: BudgetGroup;
  targetPct: number;
  targetUsd: number;
  actualUsd: number;
  diffUsd: number;
}

/** Cuánto deberías gastar por grupo (50/30/20) vs. lo real. */
export const groupTargets = (
  incomeUsd: number,
  expenses: Expense[],
  debtsPaid: Debt[],
  categories: Category[],
  settings: Omit<UserSettings, 'id'>,
): GroupTarget[] => {
  const actual = expensesByGroup(expenses, categories);
  actual.ahorro += sum(debtsPaid.map((d) => d.amountUsd));
  return (Object.keys(settings.split) as BudgetGroup[]).map((group) => {
    const targetUsd = incomeUsd * (settings.split[group] / 100);
    return { group, targetPct: settings.split[group], targetUsd, actualUsd: actual[group], diffUsd: targetUsd - actual[group] };
  });
};

export interface CategoryTarget {
  categoryId: string;
  name: string;
  color: string;
  suggestedUsd: number;
  budgetUsd: number | null;
  actualUsd: number;
  usedRatio: number;
}

/** Cuánto gastar en cada rubro: presupuesto declarado, o sugerido por % de la categoría. */
export const categoryTargets = (
  incomeUsd: number,
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
): CategoryTarget[] =>
  categories
    .map((c) => {
      const actualUsd = sum(expenses.filter((e) => e.categoryId === c.id).map((e) => e.totalUsd));
      const budget = budgets.find((b) => b.categoryId === c.id);
      const suggestedUsd = incomeUsd * ((c.suggestedPct ?? 0) / 100);
      const limit = budget?.limitUsd ?? suggestedUsd;
      return {
        categoryId: c.id,
        name: c.name,
        color: c.color,
        suggestedUsd,
        budgetUsd: budget?.limitUsd ?? null,
        actualUsd,
        usedRatio: limit > 0 ? actualUsd / limit : 0,
      };
    })
    .filter((t) => t.actualUsd > 0 || t.budgetUsd !== null || t.suggestedUsd > 0)
    .sort((a, b) => b.actualUsd - a.actualUsd);

export interface InflationSummary {
  /** Devaluación del bolívar en el período (positivo = perdió valor). */
  devaluationPct: number;
  firstRate: number;
  lastRate: number;
  days: number;
  /** Lo que pierde en USD 1.000 Bs guardados durante el período. */
  lossPer1000Bs: number;
  /** Ritmo diario promedio. */
  dailyPct: number;
}

export const inflationSummary = (rates: ExchangeRate[]): InflationSummary | null => {
  if (rates.length < 2) return null;
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = Math.max(1, daysBetween(first.date, last.date));
  const devaluationPct = 1 - first.rate / last.rate;
  return {
    devaluationPct,
    firstRate: first.rate,
    lastRate: last.rate,
    days,
    lossPer1000Bs: 1000 / first.rate - 1000 / last.rate,
    dailyPct: devaluationPct / days,
  };
};

export interface ProductInflation {
  item: InventoryItem;
  firstUsd: number;
  lastUsd: number;
  changePct: number;
}

/** Productos cuyo precio en USD cambió más (inflación real, no solo cambiaria). */
export const productInflation = (items: InventoryItem[]): ProductInflation[] =>
  items
    .filter((i) => i.priceHistory.length >= 2)
    .map((item) => {
      const h = [...item.priceHistory].sort((a, b) => a.date.localeCompare(b.date));
      const firstUsd = h[0].priceUsd;
      const lastUsd = h[h.length - 1].priceUsd;
      return { item, firstUsd, lastUsd, changePct: firstUsd > 0 ? lastUsd / firstUsd - 1 : 0 };
    })
    .sort((a, b) => b.changePct - a.changePct);

export const emergencyFundTarget = (fixedCosts: FixedCost[], months: number): number =>
  sum(fixedCosts.map((f) => f.amountUsd)) * months;

/** Tasa vigente para una fecha: la última registrada en o antes de ese día. */
export const rateForDate = (rates: ExchangeRate[], date: string, fallback: number): number => {
  const sorted = [...rates].filter((r) => r.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0]?.rate ?? fallback;
};
