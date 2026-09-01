import type {
  Category, CatalogItem, Creditor, Debt, ExchangeRate, Expense, FixedCost, Income, IncomeSource,
  MoneyOwner, NewDoc, PayStatus, Place, Product, ShoppingItem,
} from '../types';
import { colorForIndex, findByName } from './relations';
import { round2, toUsd } from './money';
import { todayIso } from './dates';

/** Valor de una celda tal como lo entrega SheetJS. */
export type Cell = string | number | boolean | Date | null | undefined;

/** Fila cruda del Excel: claves de la cabecera, valores primitivos. */
export type RawRow = Record<string, Cell>;

/** Palabras que delatan la fila de encabezados en las hojas del modelo. */
const HEADER_HINTS = ['FECHA', 'MONTO', 'DESCRIPTION', 'DESCRIPCION', 'PRODUCTO', 'CATEGORIA', 'TASA', 'DEUDOR', 'CLIENTE', 'LUGAR', 'STATUS'];

const cellText = (c: Cell): string => (typeof c === 'string' ? c.trim().toUpperCase() : '');

/**
 * Las hojas del Excel traen una fila de totales ENCIMA de los encabezados, así que
 * leerlas con `sheet_to_json` directo devuelve columnas `__EMPTY`. Aquí se busca la
 * fila que sí es encabezado y se arman los objetos a partir de ella.
 */
export const matrixToRows = (matrix: Cell[][]): RawRow[] => {
  let headerIndex = -1;
  let bestScore = 0;
  matrix.slice(0, 12).forEach((row, i) => {
    const score = row.filter((c) => HEADER_HINTS.some((h) => cellText(c) === h || cellText(c).startsWith(h))).length;
    if (score > bestScore) { bestScore = score; headerIndex = i; }
  });
  if (headerIndex === -1 || bestScore < 2) return [];

  const header = matrix[headerIndex].map((c, i) => (cellText(c) ? String(c).trim() : `col_${i}`));
  return matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((c) => c !== '' && c !== null && c !== undefined))
    .map((row) => {
      const obj: RawRow = {};
      header.forEach((key, i) => { obj[key] = row[i]; });
      return obj;
    });
};

/** Hojas sin encabezado fiable (LISTA): devuelve las filas con celdas útiles. */
export const matrixToLooseRows = (matrix: Cell[][]): RawRow[] =>
  matrix
    .filter((row) => row.some((c) => typeof c === 'string' && c.trim().length > 1))
    .map((row) => {
      const obj: RawRow = {};
      row.forEach((c, i) => { obj[`col_${i}`] = c; });
      return obj;
    });

/* ---------- Lectura de celdas ---------- */

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const pad = (n: number): string => String(n).padStart(2, '0');

/** Serial de Excel (46249) -> YYYY-MM-DD, redondeando al día más cercano. */
const fromSerial = (serial: number): string => {
  const d = new Date(EXCEL_EPOCH + Math.round(serial) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/**
 * Convierte el serial de fecha de Excel, un `Date` o un texto a YYYY-MM-DD.
 *
 * SheetJS a veces entrega los `Date` con la hora en 23:59:59.999 del día
 * anterior (redondeo del serial), así que hay que reconstruir la fecha desde la
 * hora local redondeada al día, no con `toISOString()`, o todo se corre un día.
 */
export const excelDate = (value: RawRow[string]): string | null => {
  if (value instanceof Date) {
    const localMs = value.getTime() - value.getTimezoneOffset() * 60_000;
    const rounded = new Date(Math.round(localMs / 86_400_000) * 86_400_000);
    return `${rounded.getUTCFullYear()}-${pad(rounded.getUTCMonth() + 1)}-${pad(rounded.getUTCDate())}`;
  }
  if (typeof value === 'number' && value > 20000 && value < 90000) {
    return fromSerial(value);
  }
  if (typeof value === 'string') {
    const iso = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const dmy = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return null;
};

export const num = (value: RawRow[string]): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    // Formatos venezolanos: 1.234,56 y 1,234.56
    const clean = value.replace(/[^\d,.-]/g, '');
    const normalized = clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? clean.replace(/\./g, '').replace(',', '.')
      : clean.replace(/,/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export const str = (value: RawRow[string]): string => (value === null || value === undefined ? '' : String(value).trim());

/** Toma el primer valor no vacío entre varios nombres de columna posibles. */
export const pick = (row: RawRow, ...keys: string[]): RawRow[string] => {
  for (const k of keys) {
    const found = Object.keys(row).find((c) => c.trim().toUpperCase() === k.toUpperCase());
    if (found && row[found] !== '' && row[found] !== null && row[found] !== undefined) return row[found];
  }
  return undefined;
};

const parseStatus = (value: string): PayStatus => {
  const v = value.toUpperCase();
  if (v.includes('PAGAD')) return 'pagada';
  if (v.includes('PROCESO')) return 'en_proceso';
  return 'pendiente';
};

const parseOwner = (value: string): MoneyOwner => (value.toUpperCase().includes('TERCERO') ? 'tercero' : 'propio');

/* ---------- Catálogos que se van creando durante la importación ---------- */

export interface CatalogDraft {
  name: string;
  color: string;
}

/** Acumula nombres nuevos que aún no existen en el catálogo actual. */
export class CatalogResolver<T extends CatalogItem> {
  private nuevos = new Map<string, CatalogDraft>();

  constructor(private existing: T[]) {}

  /** Devuelve la clave del catálogo: el id real si existe, o `nuevo:<nombre>`. */
  key(name: string): string {
    const clean = name.trim();
    if (!clean) return '';
    const hit = findByName(this.existing, clean);
    if (hit) return hit.id;
    const lower = clean.toLowerCase();
    if (!this.nuevos.has(lower)) {
      this.nuevos.set(lower, { name: clean, color: colorForIndex(this.existing.length + this.nuevos.size) });
    }
    return `nuevo:${lower}`;
  }

  get pending(): CatalogDraft[] {
    return [...this.nuevos.values()];
  }
}

/* ---------- Resultado del análisis ---------- */

export interface ParsedWorkbook {
  rates: NewDoc<ExchangeRate>[];
  incomes: NewDoc<Income>[];
  expenses: NewDoc<Expense>[];
  fixedCosts: NewDoc<FixedCost>[];
  debts: NewDoc<Debt>[];
  shopping: NewDoc<ShoppingItem>[];
  newCategories: CatalogDraft[];
  newProducts: CatalogDraft[];
  newPlaces: CatalogDraft[];
  newCreditors: CatalogDraft[];
  newSources: CatalogDraft[];
  /** Avisos de filas que se saltaron y por qué. */
  warnings: string[];
}

export interface ExistingCatalogs {
  categories: Category[];
  products: Product[];
  places: Place[];
  creditors: Creditor[];
  incomeSources: IncomeSource[];
  rates: ExchangeRate[];
}

const rateFor = (rates: NewDoc<ExchangeRate>[], existing: ExchangeRate[], date: string): number => {
  const all = [...existing.map((r) => ({ date: r.date, rate: r.rate })), ...rates];
  const prior = all.filter((r) => r.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  return prior[0]?.rate ?? 0;
};

/**
 * Traduce las hojas del modelo en Excel (TASA_BCV, BD_INGRESOS, BD_GASTOS,
 * BD_COSTOSFIJOS, BD_DEUDAS, LISTA, URGENCIAS) al modelo de la app.
 */
export const parseWorkbook = (sheets: Record<string, RawRow[]>, existing: ExistingCatalogs): ParsedWorkbook => {
  const warnings: string[] = [];
  const categories = new CatalogResolver(existing.categories);
  const places = new CatalogResolver(existing.places);
  const creditors = new CatalogResolver(existing.creditors);
  const sources = new CatalogResolver(existing.incomeSources);
  const products = new CatalogResolver(existing.products);

  const sheetOf = (...names: string[]): RawRow[] => {
    for (const n of names) {
      const key = Object.keys(sheets).find((k) => k.trim().toUpperCase() === n.toUpperCase());
      if (key) return sheets[key];
    }
    return [];
  };

  /* Tasas */
  const rates: NewDoc<ExchangeRate>[] = [];
  const seenRates = new Set<string>();
  sheetOf('TASA_BCV', 'TASAS').forEach((row) => {
    const date = excelDate(pick(row, 'FECHA'));
    const rate = num(pick(row, 'TASA'));
    if (!date || rate <= 0 || seenRates.has(date)) return;
    seenRates.add(date);
    rates.push({ date, rate, source: 'excel' });
  });

  /* Ingresos */
  const incomes: NewDoc<Income>[] = [];
  sheetOf('BD_INGRESOS').forEach((row, i) => {
    const date = excelDate(pick(row, 'FECHA'));
    const amountBs = num(pick(row, 'MONTO BS', 'MONTO'));
    if (!date || amountBs <= 0) { if (str(pick(row, 'CLIENTE'))) warnings.push(`BD_INGRESOS fila ${i + 2}: sin fecha o monto válido.`); return; }
    const rate = num(pick(row, 'TASA')) || rateFor(rates, existing.rates, date);
    incomes.push({
      date,
      sourceId: sources.key(str(pick(row, 'CLIENTE', 'ORIGEN')) || 'Sin origen'),
      amountBs,
      rate,
      amountUsd: round2(num(pick(row, 'MONTO EN $ BCV')) || toUsd(amountBs, rate)),
      owner: parseOwner(str(pick(row, 'TIPO'))),
    });
  });

  /* Gastos */
  const expenses: NewDoc<Expense>[] = [];
  sheetOf('BD_GASTOS').forEach((row, i) => {
    const date = excelDate(pick(row, 'FECHA'));
    const totalBs = num(pick(row, 'TOTAL'));
    const product = str(pick(row, 'PRODUCTO', 'DESCRIPTION'));
    if (!date || totalBs <= 0) { if (product) warnings.push(`BD_GASTOS fila ${i + 2}: «${product}» sin fecha o total válido.`); return; }
    const rate = num(pick(row, 'TASA')) || rateFor(rates, existing.rates, date);
    const quantity = num(pick(row, 'CANTIDAD')) || 1;
    expenses.push({
      date,
      placeId: places.key(str(pick(row, 'LUGAR')) || 'Sin lugar'),
      categoryId: categories.key(str(pick(row, 'CATEGORIA')) || 'Sin categoría'),
      productId: products.key(product || 'Sin descripción'),
      product: product || 'Sin descripción',
      unitPriceBs: num(pick(row, 'PRECIO')) || round2(totalBs / quantity),
      quantity,
      totalBs,
      rate,
      totalUsd: round2(num(pick(row, 'TOTAL $ BCV')) || toUsd(totalBs, rate)),
    });
  });

  /* Costos fijos */
  const fixedCosts: NewDoc<FixedCost>[] = [];
  sheetOf('BD_COSTOSFIJOS').forEach((row) => {
    const date = excelDate(pick(row, 'FECHA'));
    const amountUsd = num(pick(row, 'MONTO'));
    const description = str(pick(row, 'DESCRIPTION', 'DESCRIPCION'));
    if (!description || amountUsd <= 0) return;
    const iso = date ?? todayIso();
    fixedCosts.push({
      description,
      amountUsd,
      month: iso.slice(0, 7),
      dueDay: Number(iso.slice(8, 10)) || 1,
      status: parseStatus(str(pick(row, 'STATUS'))),
      reference: str(pick(row, 'REFERENCIA')) || undefined,
    });
  });

  /* Deudas */
  const debts: NewDoc<Debt>[] = [];
  sheetOf('BD_DEUDAS').forEach((row) => {
    const amountUsd = num(pick(row, 'MONTO'));
    const creditor = str(pick(row, 'DEUDOR', 'ACREEDOR'));
    if (!creditor || amountUsd <= 0) return;
    debts.push({
      creditorId: creditors.key(creditor),
      merchant: str(pick(row, 'EMPRESA O CLIENTE', 'EMPRESA')) || creditor,
      description: str(pick(row, 'DESCRIPTION', 'DESCRIPCION')) || undefined,
      amountUsd,
      dueDate: excelDate(pick(row, 'FECHA DE VENCIMIENTO', 'VENCIMIENTO')) ?? todayIso(),
      status: parseStatus(str(pick(row, 'STATUS'))),
      owner: parseOwner(str(pick(row, 'PERSONA'))),
      reference: str(pick(row, 'REFERENCIA')) || undefined,
    });
  });

  /* Lista de compras + urgencias */
  const shopping: NewDoc<ShoppingItem>[] = [];
  const created = todayIso();
  sheetOf('LISTA').forEach((row) => {
    const values = Object.values(row);
    const name = str(values.find((v) => typeof v === 'string' && v.trim()));
    if (!name) return;
    const numbers = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    shopping.push({ name, quantity: numbers[0] ?? 1, unit: 'und', estimatedUsd: round2(numbers[1] ?? 0), priority: 'normal', checked: false, createdAt: created });
  });
  sheetOf('URGENCIAS').forEach((row) => {
    const name = str(pick(row, 'CATEGORIA', 'DESCRIPCION', 'DESCRIPTION'));
    if (!name) return;
    shopping.push({ name, quantity: 1, unit: 'und', estimatedUsd: round2(num(pick(row, 'MONTO APROXIMADO', 'MONTO'))), priority: 'urgente', checked: parseStatus(str(pick(row, 'STATUS'))) === 'pagada', createdAt: created });
  });

  return {
    rates, incomes, expenses, fixedCosts, debts, shopping,
    newCategories: categories.pending,
    newProducts: products.pending,
    newPlaces: places.pending,
    newCreditors: creditors.pending,
    newSources: sources.pending,
    warnings,
  };
};

/** Sustituye las claves `nuevo:<nombre>` por los ids reales ya creados. */
export const resolveKey = (key: string, map: Map<string, string>): string =>
  key.startsWith('nuevo:') ? map.get(key.slice(6)) ?? '' : key;
