// Única fuente de tipos del proyecto. Todo el modelo vive aquí.

export type Currency = 'VES' | 'USD';

/** Origen del dinero: propio o de un tercero que pasa por mi cuenta. */
export type MoneyOwner = 'propio' | 'tercero';

export type PayStatus = 'pendiente' | 'en_proceso' | 'pagada';

/** Grupo presupuestario (regla 50/30/20). */
export type BudgetGroup = 'necesidad' | 'deseo' | 'ahorro';

export interface ExchangeRate {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Bs por 1 USD */
  rate: number;
  source: 'BCV' | 'manual';
}

export interface Category {
  id: string;
  name: string;
  group: BudgetGroup;
  color: string;
  /** Porcentaje sugerido del ingreso mensual (se usa en reportes). */
  suggestedPct?: number;
}

export interface Income {
  id: string;
  date: string;
  source: string;
  amountBs: number;
  rate: number;
  amountUsd: number;
  owner: MoneyOwner;
  note?: string;
}

export interface Expense {
  id: string;
  date: string;
  place: string;
  categoryId: string;
  product: string;
  unitPriceBs: number;
  quantity: number;
  totalBs: number;
  rate: number;
  totalUsd: number;
  /** Si el gasto agregó stock al inventario. */
  inventoryItemId?: string;
  note?: string;
}

export interface FixedCost {
  id: string;
  description: string;
  amountUsd: number;
  /** YYYY-MM al que pertenece la cuota */
  month: string;
  dueDay: number;
  status: PayStatus;
  paidDate?: string;
  reference?: string;
}

export interface Debt {
  id: string;
  creditor: string;
  merchant: string;
  description?: string;
  amountUsd: number;
  dueDate: string;
  status: PayStatus;
  owner: MoneyOwner;
  installment?: string;
  reference?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limitUsd: number;
}

export type StockUnit = 'und' | 'kg' | 'g' | 'l' | 'ml' | 'paq';

export interface PricePoint {
  date: string;
  priceBs: number;
  priceUsd: number;
  rate: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  unit: StockUnit;
  minQuantity: number;
  lastPriceBs: number;
  lastPriceUsd: number;
  lastPurchaseDate?: string;
  lastPlace?: string;
  /** Historial de precios para medir inflación real del producto. */
  priceHistory: PricePoint[];
}

export type ShoppingPriority = 'urgente' | 'normal' | 'cuando_se_pueda';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: StockUnit;
  estimatedUsd: number;
  priority: ShoppingPriority;
  checked: boolean;
  inventoryItemId?: string;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  /** Porcentaje máximo del ingreso destinado a deuda (default 35). */
  maxDebtRatioPct: number;
  /** Meses de costos fijos que debe cubrir el fondo de emergencia. */
  emergencyFundMonths: number;
  /** Reparto objetivo 50/30/20. */
  split: Record<BudgetGroup, number>;
}

/** Cualquier documento persistido tiene id. */
export type WithId = { id: string };
export type NewDoc<T extends WithId> = Omit<T, 'id'>;
