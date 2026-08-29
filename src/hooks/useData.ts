import { useContext } from 'react';
import { DataContext, type DataValue } from '../context/dataContext';

export const useData = (): DataValue => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
};
