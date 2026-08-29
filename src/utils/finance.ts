import type { Budget, BudgetGroup, Category, Debt, Expense, ExchangeRate, FixedCost, Income, InventoryItem, UserSettings } from '../types';
import { daysBetween } from './dates';
import { sum } from './money';

export const DEFAULT_SETTINGS: Omit<UserSettings, 'id'> = {
  maxDebtRatioPct: 25,
  emergencyFundMonths: 4,
  savingsTargetPct: 15,
  householdSize: 3,
  split: { necesidad: 55, deseo: 20, ahorro: 25 },
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


/* ---------------------------------------------------------------
   Liquidez y plan de acción
   --------------------------------------------------------------- */

export interface CashNeed {
  /** Vencido y sin pagar. */
  overdueUsd: number;
  /** Vence dentro de la ventana (por defecto, 7 días). */
  dueSoonUsd: number;
  /** Compras marcadas como urgentes. */
  urgentBuysUsd: number;
  totalUsd: number;
  items: number;
}

/**
 * Cuánto necesitas tener disponible AHORA: lo vencido, lo que vence en los
 * próximos `days` días y las compras urgentes.
 */
export const cashNeeded = (
  debts: Debt[],
  fixedCosts: FixedCost[],
  urgentBuysUsd: number,
  today: string,
  horizon: string,
): CashNeed => {
  const openDebts = debts.filter((d) => d.status !== 'pagada');
  const openFixed = fixedCosts.filter((f) => f.status !== 'pagada');

  const overdueUsd = sum(openDebts.filter((d) => d.dueDate < today).map((d) => d.amountUsd));
  const dueSoonUsd = sum(openDebts.filter((d) => d.dueDate >= today && d.dueDate <= horizon).map((d) => d.amountUsd));
  const fixedTotal = sum(openFixed.map((f) => f.amountUsd));
  const items = openDebts.filter((d) => d.dueDate <= horizon).length + openFixed.length;

  return {
    overdueUsd,
    dueSoonUsd: dueSoonUsd + fixedTotal,
    urgentBuysUsd,
    totalUsd: overdueUsd + dueSoonUsd + fixedTotal + urgentBuysUsd,
    items,
  };
};

export type AdviceLevel = 'ok' | 'atencion' | 'urgente';

export interface Advice {
  id: string;
  level: AdviceLevel;
  title: string;
  detail: string;
}

export interface HealthInput {
  incomeUsd: number;
  expensesUsd: number;
  fixedUsd: number;
  debtUsd: number;
  savedUsd: number;
  emergencyTargetUsd: number;
  wantsUsd: number;
  settings: Omit<UserSettings, 'id'>;
}

/** Puntaje 0-100 de salud financiera, con el peso de cada componente. */
export const healthScore = (h: HealthInput): { score: number; parts: { label: string; value: number; max: number }[] } => {
  const ratio = (value: number, best: number, worst: number): number => {
    if (best === worst) return 1;
    return Math.max(0, Math.min(1, (worst - value) / (worst - best)));
  };
  const savingsRate = h.incomeUsd > 0 ? (h.incomeUsd - h.expensesUsd) / h.incomeUsd : 0;
  const parts = [
    { label: 'Ahorro del mes', value: Math.round(ratio(-savingsRate, -h.settings.savingsTargetPct / 100, 0.1) * 30), max: 30 },
    { label: 'Peso de la deuda', value: Math.round(ratio(h.incomeUsd > 0 ? h.debtUsd / h.incomeUsd : 1, 0, h.settings.maxDebtRatioPct / 100) * 25), max: 25 },
    { label: 'Costos fijos', value: Math.round(ratio(h.incomeUsd > 0 ? h.fixedUsd / h.incomeUsd : 1, 0.25, 0.6) * 20), max: 20 },
    { label: 'Fondo de emergencia', value: Math.round(Math.min(1, h.emergencyTargetUsd > 0 ? h.savedUsd / h.emergencyTargetUsd : 0) * 15), max: 15 },
    { label: 'Gasto en deseos', value: Math.round(ratio(h.incomeUsd > 0 ? h.wantsUsd / h.incomeUsd : 0, 0.05, h.settings.split.deseo / 100) * 10), max: 10 },
  ];
  return { score: sum(parts.map((p) => p.value)), parts };
};

/** Recomendaciones concretas, ordenadas por urgencia. */
export const buildAdvice = (h: HealthInput, overdueUsd: number, topCategory?: { name: string; usd: number }): Advice[] => {
  const advice: Advice[] = [];
  const pct = (v: number) => (h.incomeUsd > 0 ? v / h.incomeUsd : 0);
  const savings = h.incomeUsd - h.expensesUsd;

  if (overdueUsd > 0) {
    advice.push({ id: 'vencido', level: 'urgente', title: 'Paga primero lo vencido',
      detail: `Tienes ${formatMoney(overdueUsd)} vencidos. En Venezuela el atraso se encarece dos veces: por recargo y por devaluación mientras esperas.` });
  }
  if (savings < 0) {
    advice.push({ id: 'deficit', level: 'urgente', title: 'Gastaste más de lo que entró',
      detail: `El mes cierra en ${formatMoney(savings)}. Antes de recortar rubros pequeños, revisa cuotas y deseos: son lo único que puedes frenar de inmediato.` });
  }
  if (pct(h.debtUsd) > h.settings.maxDebtRatioPct / 100) {
    advice.push({ id: 'deuda', level: 'urgente', title: 'La deuda pasó tu techo',
      detail: `Las cuotas se llevan ${(pct(h.debtUsd) * 100).toFixed(1)}% del ingreso, por encima del ${h.settings.maxDebtRatioPct}% que te fijaste. No asumas cuotas nuevas hasta bajar de ahí.` });
  } else if (pct(h.debtUsd) > 0.2) {
    advice.push({ id: 'deuda-media', level: 'atencion', title: 'La deuda pesa más de lo cómodo',
      detail: `${(pct(h.debtUsd) * 100).toFixed(1)}% del ingreso va a cuotas. Cada compra a crédito hoy es un ingreso comprometido de las próximas seis semanas.` });
  }
  if (pct(h.fixedUsd) > 0.5) {
    advice.push({ id: 'fijos', level: 'atencion', title: 'Costos fijos muy altos',
      detail: `Los fijos son ${(pct(h.fixedUsd) * 100).toFixed(1)}% de lo que entra. Con esa estructura, un mes flojo de ingresos te deja sin margen.` });
  }
  if (h.savedUsd < h.emergencyTargetUsd) {
    const falta = h.emergencyTargetUsd - h.savedUsd;
    advice.push({ id: 'fondo', level: h.savedUsd <= 0 ? 'atencion' : 'ok', title: 'Completa el fondo de emergencia',
      detail: `Te faltan ${formatMoney(falta)} para cubrir ${h.settings.emergencyFundMonths} meses de costos fijos. Guárdalo en divisas, no en bolívares.` });
  }
  if (pct(h.wantsUsd) > h.settings.split.deseo / 100) {
    advice.push({ id: 'deseos', level: 'atencion', title: 'Los deseos se pasaron del reparto',
      detail: `${formatMoney(h.wantsUsd)} en deseos, ${(pct(h.wantsUsd) * 100).toFixed(1)}% del ingreso. Tu meta es ${h.settings.split.deseo}%.` });
  }
  if (topCategory && pct(topCategory.usd) > 0.25) {
    advice.push({ id: 'concentracion', level: 'atencion', title: `«${topCategory.name}» concentra el gasto`,
      detail: `Un solo rubro se lleva ${(pct(topCategory.usd) * 100).toFixed(1)}% del ingreso. Vale la pena ponerle tope y revisarlo semana a semana.` });
  }
  if (savings > 0 && pct(savings) >= h.settings.savingsTargetPct / 100) {
    advice.push({ id: 'bien', level: 'ok', title: 'Vas por encima de tu meta de ahorro',
      detail: `Apartaste ${formatMoney(savings)} (${(pct(savings) * 100).toFixed(1)}%). Muévelo a divisas el mismo día que cobras y no lo dejes en la cuenta.` });
  }

  const order: Record<AdviceLevel, number> = { urgente: 0, atencion: 1, ok: 2 };
  return advice.sort((a, b) => order[a.level] - order[b.level]);
};

const formatMoney = (n: number): string => `$${n.toFixed(2)}`;

/** Aporte mensual necesario para llegar a una meta en su fecha. */
export const monthlyContribution = (targetUsd: number, savedUsd: number, deadline?: string, today = new Date()): number | null => {
  if (!deadline) return null;
  const end = new Date(`${deadline}T00:00:00`);
  const months = Math.max(1, (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth());
  return Math.max(0, (targetUsd - savedUsd) / months);
};
