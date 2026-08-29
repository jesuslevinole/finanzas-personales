// Única fuente de tipos del proyecto. Todo el modelo vive aquí.

/** Origen del dinero: propio o de un tercero que pasa por mi cuenta. */
export type MoneyOwner = 'propio' | 'tercero';

export type PayStatus = 'pendiente' | 'en_proceso' | 'pagada';

/** Grupo presupuestario (regla 50/30/20). */
export type BudgetGroup = 'necesidad' | 'deseo' | 'ahorro';

/* ---------------------------------------------------------------
   Catálogos — misma forma para todos (id + nombre + color + activo),
   resueltos con utils/relations.ts y editados en la vista Catálogos.
   --------------------------------------------------------------- */

export interface CatalogItem {
  id: string;
  name: string;
  color: string;
  active: boolean;
  note?: string;
}

/** Rubro de gasto: catálogo + datos de presupuesto. */
export interface Category extends CatalogItem {
  group: BudgetGroup;
  /** Porcentaje sugerido del ingreso mensual. */
  suggestedPct?: number;
}

/** Lugar o comercio donde se gasta (Maraplus, Yummy, Digitel…). */
export type Place = CatalogItem;
/** Acreedor de deuda (Cashea, Ubii, Tendencias…). */
export type Creditor = CatalogItem;
/** Origen de ingreso (cliente, alquiler, Binance…). */
export type IncomeSource = CatalogItem;

/* ---------------------------------------------------------------
   Movimientos
   --------------------------------------------------------------- */

export interface ExchangeRate {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Bs por 1 USD */
  rate: number;
  source: 'BCV' | 'manual' | 'excel';
}

export interface Income {
  id: string;
  date: string;
  sourceId: string;
  amountBs: number;
  rate: number;
  amountUsd: number;
  owner: MoneyOwner;
  note?: string;
}

export interface Expense {
  id: string;
  date: string;
  placeId: string;
  categoryId: string;
  product: string;
  unitPriceBs: number;
  quantity: number;
  totalBs: number;
  rate: number;
  totalUsd: number;
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
  creditorId: string;
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

/* ---------------------------------------------------------------
   Despensa
   --------------------------------------------------------------- */

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
  lastPlaceId?: string;
  priceHistory: PricePoint[];
}

export type ShoppingPriority = 'urgente' | 'normal' | 'cuando_se_pueda';

/** Carpeta de compra: una salida al supermercado, con su tope de gasto. */
export interface ShoppingList {
  id: string;
  name: string;
  placeId?: string;
  /** Tope que te pusiste antes de salir. 0 = sin tope. */
  budgetUsd: number;
  status: 'abierta' | 'cerrada';
  createdAt: string;
  closedAt?: string;
  note?: string;
}

export interface ShoppingItem {
  id: string;
  /** Carpeta a la que pertenece. Vacío = lista general. */
  listId?: string;
  name: string;
  quantity: number;
  unit: StockUnit;
  /** Precio esperado, tomado de la última compra. */
  estimatedUsd: number;
  /** Precio real al meterlo en el carrito. */
  actualBs?: number;
  actualUsd?: number;
  priority: ShoppingPriority;
  checked: boolean;
  inventoryItemId?: string;
  createdAt: string;
}

/* ---------------------------------------------------------------
   Accesos — un nivel por módulo, tres niveles posibles.
   --------------------------------------------------------------- */

export type ModuleKey =
  | 'resumen' | 'recordatorios' | 'movimientos' | 'costos-fijos' | 'deudas' | 'presupuesto'
  | 'reportes' | 'inventario' | 'compras' | 'tasa' | 'catalogos'
  | 'importar' | 'usuarios' | 'ajustes';

export type AccessLevel = 'sin_acceso' | 'ver' | 'editar';

export interface Role {
  id: string;
  name: string;
  description?: string;
  access: Partial<Record<ModuleKey, AccessLevel>>;
}

/** Persona con acceso al espacio del dueño. El id del documento es su email. */
export interface Member {
  id: string;
  email: string;
  name?: string;
  roleId: string;
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
