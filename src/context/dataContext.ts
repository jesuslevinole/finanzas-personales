import { createContext } from 'react';
import type {
  Budget, Category, Creditor, Debt, Expense, ExchangeRate, FixedCost, Income, IncomeSource,
  Goal, InventoryItem, Member, NewDoc, Place, Product, Role, ShoppingItem, ShoppingList, UserSettings, WithId,
} from '../types';
import type { CollectionName } from '../services/firestore';
import type { Settings } from '../utils/finance';

/**
 * Un solo lugar con listeners onSnapshot para todas las colecciones.
 * Las vistas consumen datos desde aquí y NO hacen su propio fetch (evita datos congelados).
 */
export interface DataValue {
  ready: boolean;
  /** Mensaje de Firestore si la sincronización falló (reglas, red…). */
  error: string | null;
  /** Último fallo de escritura, para avisar al usuario. */
  writeError: string | null;
  clearWriteError: () => void;
  rates: ExchangeRate[];
  categories: Category[];
  places: Place[];
  creditors: Creditor[];
  incomeSources: IncomeSource[];
  products: Product[];
  incomes: Income[];
  expenses: Expense[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  budgets: Budget[];
  goals: Goal[];
  inventory: InventoryItem[];
  shopping: ShoppingItem[];
  shoppingLists: ShoppingList[];
  roles: Role[];
  members: Member[];
  /** Reglas del mes en curso (atajo de `settingsFor`). */
  settings: Settings;
  /** Todos los documentos de ajustes, uno por mes con reglas propias. */
  settingsDocs: UserSettings[];
  /** Reglas vigentes para un mes concreto (hereda del mes anterior). */
  settingsFor: (month: string) => Settings;
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
