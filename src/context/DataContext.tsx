import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Budget, Category, Creditor, Debt, Expense, ExchangeRate, FixedCost, Income, IncomeSource,
  Goal, InventoryItem, Member, Place, Role, ShoppingItem, ShoppingList, UserSettings,
} from '../types';
import { create, createMany, patch, remove, removeAll, subscribe, upsert } from '../services/firestore';
import { DEFAULT_SETTINGS } from '../utils/finance';
import { useAuth } from '../hooks/useAuth';
import { DataContext, type DataValue } from './dataContext';

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settingsDocs, setSettingsDocs] = useState<UserSettings[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const fail = (e: Error) => setError(e.message);
    const unsubs = [
      subscribe<ExchangeRate>(uid, 'rates', setRates, fail, 'date'),
      subscribe<Category>(uid, 'categories', setCategories, fail),
      subscribe<Place>(uid, 'places', setPlaces, fail),
      subscribe<Creditor>(uid, 'creditors', setCreditors, fail),
      subscribe<IncomeSource>(uid, 'incomeSources', setIncomeSources, fail),
      subscribe<Income>(uid, 'incomes', setIncomes, fail, 'date'),
      subscribe<Expense>(uid, 'expenses', setExpenses, fail, 'date'),
      subscribe<FixedCost>(uid, 'fixedCosts', setFixedCosts, fail, 'month'),
      subscribe<Debt>(uid, 'debts', setDebts, fail, 'dueDate'),
      subscribe<Budget>(uid, 'budgets', setBudgets, fail),
      subscribe<Goal>(uid, 'goals', setGoals, fail, 'priority'),
      subscribe<InventoryItem>(uid, 'inventory', setInventory, fail),
      subscribe<ShoppingItem>(uid, 'shopping', setShopping, fail, 'createdAt'),
      subscribe<ShoppingList>(uid, 'shoppingLists', setShoppingLists, fail, 'createdAt'),
      subscribe<Role>(uid, 'roles', setRoles, fail),
      subscribe<Member>(uid, 'members', setMembers, fail),
      subscribe<UserSettings>(uid, 'settings', (rows) => { setSettingsDocs(rows); setReady(true); }, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const value = useMemo<DataValue>(() => {
    const settings: Omit<UserSettings, 'id'> = settingsDocs[0] ?? DEFAULT_SETTINGS;
    const currentRate = rates[0]?.rate ?? 0;
    const requireUid = (): string => {
      if (!uid) throw new Error('No hay sesión activa');
      return uid;
    };
    /** Envuelve una escritura para que un fallo de red se vea en pantalla. */
    const guard = <R,>(op: () => Promise<R>): Promise<R> =>
      op().catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'No se pudo guardar.';
        setWriteError(message);
        throw e;
      });

    return {
      ready, error, writeError,
      clearWriteError: () => setWriteError(null),
      rates, categories, places, creditors, incomeSources, incomes, expenses,
      fixedCosts, debts, budgets, goals, inventory, shopping, shoppingLists, roles, members, settings, currentRate,
      add: (name, data) => guard(() => create(requireUid(), name, data)),
      addMany: (name, rows, onProgress) => guard(() => createMany(requireUid(), name, rows, onProgress)),
      set: (name, id, data) => guard(() => upsert(requireUid(), name, id, data)),
      update: (name, id, data) => guard(() => { requireUid(); return patch(name, id, data); }),
      del: (name, id) => guard(() => { requireUid(); return remove(name, id); }),
      delAll: (name) => guard(() => removeAll(requireUid(), name)),
    };
  }, [uid, ready, error, writeError, rates, categories, places, creditors, incomeSources, incomes, expenses, fixedCosts, debts, budgets, goals, inventory, shopping, shoppingLists, roles, members, settingsDocs]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
