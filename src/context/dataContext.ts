import { createContext } from 'react';
import type {
  Budget, Category, Debt, Expense, ExchangeRate, FixedCost, Income, InventoryItem, NewDoc, ShoppingItem, UserSettings, WithId,
} from '../types';
import type { CollectionName } from '../services/firestore';

/**
 * Un solo lugar con listeners onSnapshot para todas las colecciones.
 * Las vistas consumen datos desde aquí y NO hacen su propio fetch (evita datos congelados).
 */
export interface DataValue {
  ready: boolean;
  rates: ExchangeRate[];
  categories: Category[];
  incomes: Income[];
  expenses: Expense[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  budgets: Budget[];
  inventory: InventoryItem[];
  shopping: ShoppingItem[];
  settings: Omit<UserSettings, 'id'>;
  /** Última tasa registrada (Bs por USD). 0 si no hay ninguna. */
  currentRate: number;
  add: <T extends WithId>(name: CollectionName, data: NewDoc<T>) => Promise<string>;
  set: <T extends WithId>(name: CollectionName, id: string, data: NewDoc<T>) => Promise<void>;
  update: <T extends WithId>(name: CollectionName, id: string, data: Partial<NewDoc<T>>) => Promise<void>;
  del: (name: CollectionName, id: string) => Promise<void>;
}

export const DataContext = createContext<DataValue | null>(null);
