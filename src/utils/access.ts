import type { AccessLevel, ModuleKey, Role } from '../types';

export const MODULE_LABEL: Record<ModuleKey, string> = {
  resumen: 'Resumen',
  movimientos: 'Movimientos',
  'costos-fijos': 'Costos fijos',
  deudas: 'Deudas',
  presupuesto: 'Presupuesto',
  reportes: 'Reportes',
  inventario: 'Inventario',
  compras: 'Lista de compras',
  tasa: 'Tasa BCV',
  catalogos: 'Catálogos',
  importar: 'Importar Excel',
  usuarios: 'Usuarios y roles',
  ajustes: 'Ajustes',
};

export const MODULE_KEYS = Object.keys(MODULE_LABEL) as ModuleKey[];

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  sin_acceso: 'Sin acceso',
  ver: 'Solo ver',
  editar: 'Ver y editar',
};

export const ACCESS_LEVELS: AccessLevel[] = ['sin_acceso', 'ver', 'editar'];

/** El dueño del espacio siempre tiene todo. */
export const OWNER_ACCESS: Record<ModuleKey, AccessLevel> = MODULE_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: 'editar' }),
  {} as Record<ModuleKey, AccessLevel>,
);

export const accessOf = (role: Role | null, module: ModuleKey): AccessLevel =>
  role?.access[module] ?? 'sin_acceso';

/** Roles que se crean al inicializar el espacio. */
export const DEFAULT_ROLES: Omit<Role, 'id'>[] = [
  {
    name: 'Administrador',
    description: 'Acceso total, incluyendo usuarios y catálogos.',
    access: OWNER_ACCESS,
  },
  {
    name: 'Pareja',
    description: 'Registra movimientos y compras, no toca usuarios ni ajustes.',
    access: {
      resumen: 'ver', movimientos: 'editar', 'costos-fijos': 'editar', deudas: 'editar',
      presupuesto: 'ver', reportes: 'ver', inventario: 'editar', compras: 'editar',
      tasa: 'ver', catalogos: 'ver', importar: 'sin_acceso', usuarios: 'sin_acceso', ajustes: 'sin_acceso',
    },
  },
  {
    name: 'Solo lectura',
    description: 'Ve reportes y saldos, no modifica nada.',
    access: {
      resumen: 'ver', movimientos: 'ver', 'costos-fijos': 'ver', deudas: 'ver',
      presupuesto: 'ver', reportes: 'ver', inventario: 'ver', compras: 'ver',
      tasa: 'ver', catalogos: 'sin_acceso', importar: 'sin_acceso', usuarios: 'sin_acceso', ajustes: 'sin_acceso',
    },
  },
];
