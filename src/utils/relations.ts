import type { Category } from '../types';

export const getCategoryName = (categories: Category[], id: string): string =>
  categories.find((c) => c.id === id)?.name ?? 'Sin categoría';

export const getCategoryColor = (categories: Category[], id: string): string =>
  categories.find((c) => c.id === id)?.color ?? '#9ca3af';
