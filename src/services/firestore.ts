import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { NewDoc, WithId } from '../types';

export type CollectionName =
  | 'rates'
  | 'categories'
  | 'places'
  | 'creditors'
  | 'incomeSources'
  | 'incomes'
  | 'expenses'
  | 'fixedCosts'
  | 'debts'
  | 'budgets'
  | 'inventory'
  | 'shopping'
  | 'roles'
  | 'members'
  | 'settings';

/** Todos los datos viven bajo users/{uid}/{colección}. */
const colRef = (uid: string, name: CollectionName) => collection(db, 'users', uid, name);

const fromSnap = <T extends WithId>(snap: QueryDocumentSnapshot<DocumentData>): T =>
  ({ id: snap.id, ...snap.data() }) as T;

export const subscribe = <T extends WithId>(
  uid: string,
  name: CollectionName,
  onData: (rows: T[]) => void,
  onError: (error: Error) => void,
  orderField?: keyof T & string,
): Unsubscribe => {
  const constraints: QueryConstraint[] = orderField ? [orderBy(orderField, 'desc')] : [];
  return onSnapshot(
    query(colRef(uid, name), ...constraints),
    (qs) => onData(qs.docs.map((d) => fromSnap<T>(d))),
    onError,
  );
};

/** Quita claves con `undefined`: Firestore las rechaza al escribir. */
const clean = <T extends object>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;

export const create = async <T extends WithId>(uid: string, name: CollectionName, data: NewDoc<T>): Promise<string> => {
  const ref = await addDoc(colRef(uid, name), clean(data));
  return ref.id;
};

export const upsert = async <T extends WithId>(uid: string, name: CollectionName, id: string, data: NewDoc<T>): Promise<void> => {
  await setDoc(doc(colRef(uid, name), id), clean(data), { merge: true });
};

export const patch = async <T extends WithId>(
  uid: string,
  name: CollectionName,
  id: string,
  data: Partial<NewDoc<T>>,
): Promise<void> => {
  await updateDoc(doc(colRef(uid, name), id), clean(data));
};

export const remove = async (uid: string, name: CollectionName, id: string): Promise<void> => {
  await deleteDoc(doc(colRef(uid, name), id));
};

/** Escritura por lotes — se usa al importar el Excel. */
export const createMany = async <T extends WithId>(
  uid: string,
  name: CollectionName,
  rows: NewDoc<T>[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> => {
  let done = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((row) => batch.set(doc(colRef(uid, name)), clean(row)));
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, rows.length);
  }
  return done;
};

/** Borra todos los documentos de una colección. Solo se usa desde «Vaciar datos». */
export const removeAll = async (uid: string, name: CollectionName): Promise<number> => {
  const snap = await getDocs(colRef(uid, name));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.docs.length;
};
