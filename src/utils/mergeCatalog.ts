import type { CollectionName } from '../services/firestore';
import type { DataValue } from '../context/dataContext';

export type MergeableCatalog = 'categories' | 'places' | 'creditors' | 'incomeSources' | 'products' | 'productTypes' | 'banks' | 'people' | 'accounts';

/** Dónde se referencia cada catálogo, para reapuntar los registros al fusionar. */
interface Reference {
  collection: CollectionName;
  /** Documentos que apuntan al id de origen. */
  rows: (data: DataValue, sourceId: string) => { id: string; patch: Record<string, string> }[];
}

const REFERENCES: Record<MergeableCatalog, Reference[]> = {
  categories: [
    { collection: 'expenses', rows: (d, id) => d.expenses.filter((e) => e.categoryId === id).map((e) => ({ id: e.id, patch: { categoryId: '' } })) },
    { collection: 'budgets', rows: (d, id) => d.budgets.filter((b) => b.categoryId === id).map((b) => ({ id: b.id, patch: { categoryId: '' } })) },
    { collection: 'inventory', rows: (d, id) => d.inventory.filter((i) => i.categoryId === id).map((i) => ({ id: i.id, patch: { categoryId: '' } })) },
    { collection: 'products', rows: (d, id) => d.products.filter((p) => p.categoryId === id).map((p) => ({ id: p.id, patch: { categoryId: '' } })) },
  ],
  places: [
    { collection: 'expenses', rows: (d, id) => d.expenses.filter((e) => e.placeId === id).map((e) => ({ id: e.id, patch: { placeId: '' } })) },
    { collection: 'inventory', rows: (d, id) => d.inventory.filter((i) => i.lastPlaceId === id).map((i) => ({ id: i.id, patch: { lastPlaceId: '' } })) },
    { collection: 'shoppingLists', rows: (d, id) => d.shoppingLists.filter((l) => l.placeId === id).map((l) => ({ id: l.id, patch: { placeId: '' } })) },
  ],
  creditors: [
    { collection: 'debts', rows: (d, id) => d.debts.filter((x) => x.creditorId === id).map((x) => ({ id: x.id, patch: { creditorId: '' } })) },
  ],
  incomeSources: [
    { collection: 'incomes', rows: (d, id) => d.incomes.filter((i) => i.sourceId === id).map((i) => ({ id: i.id, patch: { sourceId: '' } })) },
  ],
  products: [
    { collection: 'expenses', rows: (d, id) => d.expenses.filter((e) => e.productId === id).map((e) => ({ id: e.id, patch: { productId: '' } })) },
    { collection: 'inventory', rows: (d, id) => d.inventory.filter((i) => i.productId === id).map((i) => ({ id: i.id, patch: { productId: '' } })) },
    { collection: 'shopping', rows: (d, id) => d.shopping.filter((s) => s.productId === id).map((s) => ({ id: s.id, patch: { productId: '' } })) },
  ],
  productTypes: [
    { collection: 'products', rows: (d, id) => d.products.filter((p) => p.typeId === id).map((p) => ({ id: p.id, patch: { typeId: '' } })) },
  ],
  banks: [
    { collection: 'expenses', rows: (d, id) => d.expenses.filter((e) => e.bankId === id).map((e) => ({ id: e.id, patch: { bankId: '' } })) },
    { collection: 'incomes', rows: (d, id) => d.incomes.filter((i) => i.bankId === id).map((i) => ({ id: i.id, patch: { bankId: '' } })) },
    { collection: 'loans', rows: (d, id) => d.loans.filter((l) => l.bankId === id).map((l) => ({ id: l.id, patch: { bankId: '' } })) },
  ],
  people: [
    { collection: 'loans', rows: (d, id) => d.loans.filter((l) => l.personId === id).map((l) => ({ id: l.id, patch: { personId: '' } })) },
  ],
  accounts: [
    { collection: 'walletMoves', rows: (d, id) => d.walletMoves.filter((m) => m.accountId === id).map((m) => ({ id: m.id, patch: { accountId: '' } })) },
  ],
};

/** Cuántos registros quedarían reapuntados si se fusiona este elemento. */
export const countReferences = (data: DataValue, catalog: MergeableCatalog, sourceId: string): number =>
  REFERENCES[catalog].reduce((total, ref) => total + ref.rows(data, sourceId).length, 0);

/**
 * Fusiona dos elementos de un catálogo: reapunta todos los registros que usaban
 * el origen hacia el destino, y luego elimina el origen. Si un producto tiene
 * nombre en el gasto (campo heredado), también se actualiza.
 */
export const mergeCatalogItems = async (
  data: DataValue,
  catalog: MergeableCatalog,
  sourceId: string,
  targetId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> => {
  if (sourceId === targetId) return 0;

  const jobs = REFERENCES[catalog].flatMap((ref) =>
    ref.rows(data, sourceId).map((row) => ({
      collection: ref.collection,
      id: row.id,
      patch: Object.fromEntries(Object.keys(row.patch).map((key) => [key, targetId])),
    })),
  );

  // Los gastos guardan el nombre del producto además del id: hay que igualarlo.
  const targetName = catalog === 'products'
    ? data.products.find((p) => p.id === targetId)?.name
    : undefined;

  let done = 0;
  for (const job of jobs) {
    const patch: Record<string, string> = { ...job.patch };
    if (targetName && job.collection === 'expenses') patch.product = targetName;
    if (targetName && (job.collection === 'inventory' || job.collection === 'shopping')) patch.name = targetName;
    await data.update(job.collection, job.id, patch);
    done += 1;
    onProgress?.(done, jobs.length);
  }

  await data.del(catalog, sourceId);
  return jobs.length;
};
