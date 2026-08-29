import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
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
  | 'incomes'
  | 'expenses'
  | 'fixedCosts'
  | 'debts'
  | 'budgets'
  | 'inventory'
  | 'shopping'
  | 'settings';

/** Todos los datos viven bajo users/{uid}/{colección}. */
const colRef = (uid: string, name: CollectionName) => collection(db, 'users', uid, name);

const fromSnap = <T extends WithId>(snap: QueryDocumentSnapshot<DocumentData>): T =>
  ({ id: snap.id, ...snap.data() }) as T;

export const subscribe = <T extends WithId>(
  uid: string,
  name: CollectionName,
  onData: (rows: T[]) => void,
  orderField?: keyof T & string,
): Unsubscribe => {
  const constraints: QueryConstraint[] = orderField ? [orderBy(orderField, 'desc')] : [];
  return onSnapshot(query(colRef(uid, name), ...constraints), (qs) => onData(qs.docs.map((d) => fromSnap<T>(d))));
};

export const create = async <T extends WithId>(uid: string, name: CollectionName, data: NewDoc<T>): Promise<string> => {
  const ref = await addDoc(colRef(uid, name), data);
  return ref.id;
};

export const upsert = async <T extends WithId>(uid: string, name: CollectionName, id: string, data: NewDoc<T>): Promise<void> => {
  await setDoc(doc(colRef(uid, name), id), data, { merge: true });
};

export const patch = async <T extends WithId>(
  uid: string,
  name: CollectionName,
  id: string,
  data: Partial<NewDoc<T>>,
): Promise<void> => {
  await updateDoc(doc(colRef(uid, name), id), data);
};

export const remove = async (uid: string, name: CollectionName, id: string): Promise<void> => {
  await deleteDoc(doc(colRef(uid, name), id));
};
