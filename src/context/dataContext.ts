import { createContext } from 'react';
import type {
  Budget, Category, Creditor, Debt, Expense, ExchangeRate, FixedCost, Income, IncomeSource,
  InventoryItem, Member, NewDoc, Place, Role, ShoppingItem, ShoppingList, UserSettings, WithId,
} from '../types';
import type { CollectionName } from '../services/firestore';

/**
 * Un solo lugar con listeners onSnapshot para todas las colecciones.
 * Las vistas consumen datos desde aquí y NO hacen su propio fetch (evita datos congelados).
 */
export interface DataValue {
  ready: boolean;
  /** Mensaje de Firestore si la sincronización falló (reglas, red…). */
  error: string | null;
  rates: ExchangeRate[];
  categories: Category[];
  places: Place[];
  creditors: Creditor[];
  incomeSources: IncomeSource[];
  incomes: Income[];
  expenses: Expense[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  budgets: Budget[];
  inventory: InventoryItem[];
  shopping: ShoppingItem[];
  shoppingLists: ShoppingList[];
  roles: Role[];
  members: Member[];
  settings: Omit<UserSettings, 'id'>;
  /** Última tasa registrada (Bs por USD). 0 si no hay ninguna. */
  currentRate: number;
  add: <T extends WithId>(name: CollectionName, data: NewDoc<T>) => Promise<string>;
  addMany: <T extends WithId>(name: CollectionName, rows: NewDoc<T>[], onProgress?: (done: number, total: number) => void) => Promise<number>;
  set: <T extends WithId>(name: CollectionName, id: string, data: NewDoc<T>) => Promise<void>;
  update: <T extends WithId>(name: CollectionName, id: string, data: Partial<NewDoc<T>>) => Promise<void>;
  del: (name: CollectionName, id: string) => Promise<void>;
  /** Vacía una colección entera. Solo desde «Vaciar datos» en Importar. */
  delAll: (name: CollectionName) => Promise<number>;
}

export const DataContext = createContext<DataValue | null>(null);
