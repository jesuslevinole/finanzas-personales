import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Budget, Category, Creditor, Debt, Expense, ExchangeRate, FixedCost, Income, IncomeSource,
  InventoryItem, Member, Place, Role, ShoppingItem, UserSettings,
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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settingsDocs, setSettingsDocs] = useState<UserSettings[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      subscribe<InventoryItem>(uid, 'inventory', setInventory, fail),
      subscribe<ShoppingItem>(uid, 'shopping', setShopping, fail, 'createdAt'),
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
    return {
      ready, error,
      rates, categories, places, creditors, incomeSources, incomes, expenses,
      fixedCosts, debts, budgets, inventory, shopping, roles, members, settings, currentRate,
      add: (name, data) => create(requireUid(), name, data),
      addMany: (name, rows, onProgress) => createMany(requireUid(), name, rows, onProgress),
      set: (name, id, data) => upsert(requireUid(), name, id, data),
      update: (name, id, data) => patch(requireUid(), name, id, data),
      del: (name, id) => remove(requireUid(), name, id),
      delAll: (name) => removeAll(requireUid(), name),
    };
  }, [uid, ready, error, rates, categories, places, creditors, incomeSources, incomes, expenses, fixedCosts, debts, budgets, inventory, shopping, roles, members, settingsDocs]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
