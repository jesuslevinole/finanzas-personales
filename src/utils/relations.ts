import type { CatalogItem } from '../types';

/** Resuelve un id contra cualquier catálogo (rubros, lugares, acreedores, orígenes). */
export const getRelationName = <T extends CatalogItem>(catalog: T[], id: string, fallback = 'Sin asignar'): string =>
  catalog.find((c) => c.id === id)?.name ?? fallback;

export const getRelationColor = <T extends CatalogItem>(catalog: T[], id: string, fallback = '#9ca3af'): string =>
  catalog.find((c) => c.id === id)?.color ?? fallback;

export const activeOnly = <T extends CatalogItem>(catalog: T[]): T[] => catalog.filter((c) => c.active !== false);

/** Busca por nombre (case-insensitive) — se usa al importar datos externos. */
export const findByName = <T extends CatalogItem>(catalog: T[], name: string): T | undefined =>
  catalog.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

/** Paleta base para asignar color a catálogos nuevos. */
export const CATALOG_COLORS = [
  '#5b3df5', '#0f8a5f', '#16a34a', '#c2410c', '#ec4899', '#0ea5e9', '#dc2626',
  '#f59e0b', '#6366f1', '#64748b', '#f97316', '#a855f7', '#14b8a6', '#22c55e',
];

export const colorForIndex = (i: number): string => CATALOG_COLORS[i % CATALOG_COLORS.length];
