import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataContext, type DataValue } from './dataContext';
import type {
  Budget, Category, Debt, Expense, ExchangeRate, FixedCost, Income, InventoryItem, ShoppingItem, UserSettings,
} from '../types';
import { create, patch, remove, subscribe, upsert } from '../services/firestore';
import { DEFAULT_SETTINGS } from '../utils/finance';
import { useAuth } from '../hooks/useAuth';



export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [settingsDocs, setSettingsDocs] = useState<UserSettings[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      subscribe<ExchangeRate>(uid, 'rates', setRates, 'date'),
      subscribe<Category>(uid, 'categories', setCategories),
      subscribe<Income>(uid, 'incomes', setIncomes, 'date'),
      subscribe<Expense>(uid, 'expenses', setExpenses, 'date'),
      subscribe<FixedCost>(uid, 'fixedCosts', setFixedCosts, 'month'),
      subscribe<Debt>(uid, 'debts', setDebts, 'dueDate'),
      subscribe<Budget>(uid, 'budgets', setBudgets),
      subscribe<InventoryItem>(uid, 'inventory', setInventory),
      subscribe<ShoppingItem>(uid, 'shopping', setShopping, 'createdAt'),
      subscribe<UserSettings>(uid, 'settings', (rows) => { setSettingsDocs(rows); setReady(true); }),
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
      ready,
      rates, categories, incomes, expenses, fixedCosts, debts, budgets, inventory, shopping, settings, currentRate,
      add: (name, data) => create(requireUid(), name, data),
      set: (name, id, data) => upsert(requireUid(), name, id, data),
      update: (name, id, data) => patch(requireUid(), name, id, data),
      del: (name, id) => remove(requireUid(), name, id),
    };
  }, [uid, ready, rates, categories, incomes, expenses, fixedCosts, debts, budgets, inventory, shopping, settingsDocs]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

