const bsFmt = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', minimumFractionDigits: 2 });
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat('es-VE', { style: 'percent', maximumFractionDigits: 1 });

export const formatBs = (n: number): string => bsFmt.format(n).replace('VES', 'Bs.');
export const formatUsd = (n: number): string => usdFmt.format(n);
export const formatPct = (ratio: number): string => pctFmt.format(ratio);

export const toUsd = (bs: number, rate: number): number => (rate > 0 ? bs / rate : 0);
export const toBs = (usd: number, rate: number): number => usd * rate;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
