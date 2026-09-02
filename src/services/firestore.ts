import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { WORKSPACE_ID } from '../workspace';
import type { NewDoc, WithId } from '../types';

export type CollectionName =
  | 'rates'
  | 'categories'
  | 'places'
  | 'creditors'
  | 'incomeSources'
  | 'products'
  | 'productTypes'
  | 'incomes'
  | 'expenses'
  | 'fixedCosts'
  | 'debts'
  | 'budgets'
  | 'goals'
  | 'inventory'
  | 'shopping'
  | 'shoppingLists'
  | 'roles'
  | 'members'
  | 'settings';

/**
 * Cada colección es de primer nivel (`expenses`, `debts`, …) y cada documento
 * lleva `ownerId` con el id del espacio compartido (no del dispositivo), de modo
 * que todos los equipos ven exactamente los mismos datos sin iniciar sesión.
 */
const colRef = (name: CollectionName) => collection(db, name);

/** Campo que marca al dueño del documento. */
export const OWNER_FIELD = 'ownerId';

/** Documentos con id propio (tasas por fecha, ajustes) se prefijan con el espacio. */
const scopedId = (id: string): string => `${WORKSPACE_ID}__${id}`;

const fromSnap = <T extends WithId>(snap: QueryDocumentSnapshot<DocumentData>): T =>
  ({ id: snap.id, ...snap.data() }) as T;

/** Quita claves con `undefined`: Firestore las rechaza al escribir. */
const clean = <T extends object>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;

const withOwner = <T extends object>(data: T): T & { ownerId: string } =>
  ({ ...clean(data), [OWNER_FIELD]: WORKSPACE_ID }) as T & { ownerId: string };

/**
 * Escucha una colección filtrada por dueño. El orden se resuelve en memoria a
 * propósito: `where` + `orderBy` sobre campos distintos exigiría un índice
 * compuesto por cada colección, y los volúmenes aquí son pequeños.
 */
export const subscribe = <T extends WithId>(
  name: CollectionName,
  onData: (rows: T[]) => void,
  onError: (error: Error) => void,
  orderField?: keyof T & string,
): Unsubscribe =>
  onSnapshot(
    query(colRef(name), where(OWNER_FIELD, '==', WORKSPACE_ID)),
    (qs) => {
      const rows = qs.docs.map((d) => fromSnap<T>(d));
      if (orderField) {
        rows.sort((a, b) => String(b[orderField] ?? '').localeCompare(String(a[orderField] ?? '')));
      }
      onData(rows);
    },
    onError,
  );

export const create = async <T extends WithId>(name: CollectionName, data: NewDoc<T>): Promise<string> => {
  const ref = await addDoc(colRef(name), withOwner(data));
  return ref.id;
};

/** Crea o actualiza un documento con id conocido (fecha, 'main', correo). */
export const upsert = async <T extends WithId>(name: CollectionName, id: string, data: NewDoc<T>): Promise<void> => {
  await setDoc(doc(colRef(name), scopedId(id)), withOwner(data), { merge: true });
};

export const patch = async <T extends WithId>(
  name: CollectionName,
  id: string,
  data: Partial<NewDoc<T>>,
): Promise<void> => {
  await updateDoc(doc(colRef(name), id), clean(data));
};

export const remove = async (name: CollectionName, id: string): Promise<void> => {
  await deleteDoc(doc(colRef(name), id));
};

/** Escritura por lotes — se usa al importar el Excel. */
export const createMany = async <T extends WithId>(
  name: CollectionName,
  rows: NewDoc<T>[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> => {
  let done = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((row) => batch.set(doc(colRef(name)), withOwner(row)));
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, rows.length);
  }
  return done;
};

/** Borra todos los documentos del espacio en una colección. Solo desde «Vaciar datos». */
export const removeAll = async (name: CollectionName): Promise<number> => {
  const snap = await getDocs(query(colRef(name), where(OWNER_FIELD, '==', WORKSPACE_ID)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.docs.length;
};
