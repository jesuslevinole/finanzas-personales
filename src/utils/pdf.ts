import type { Category, Expense, Income, Place, ShoppingItem, ShoppingList } from '../types';
import { getRelationName } from './relations';
import { formatBs, formatUsd, sum, toBs } from './money';
import { monthLabel, shortDate, todayIso } from './dates';

/** Paleta del PDF, alineada con la de la app. */
const INK = '#14122b';
const MUTED = '#6b6f85';
const PRIMARY: [number, number, number] = [91, 61, 245];
const OK: [number, number, number] = [15, 138, 95];
const DANGER: [number, number, number] = [220, 38, 38];

const MARGIN = 14;

/** jsPDF y autotable pesan bastante: se cargan solo al exportar. */
const loadPdf = async () => {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { JsPDF, autoTable };
};

type Doc = import('jspdf').jsPDF;

const header = (doc: Doc, title: string, subtitle: string) => {
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, MARGIN, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, MARGIN, 19);
  doc.text(`Generado el ${shortDate(todayIso())}`, doc.internal.pageSize.getWidth() - MARGIN, 19, { align: 'right' });
  doc.setTextColor(INK);
};

/** Fila de tarjetas con una cifra grande cada una. */
const statCards = (doc: Doc, y: number, cards: { label: string; value: string; hint?: string; tone?: 'ok' | 'danger' }[]) => {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const gap = 4;
  const cardW = (width - gap * (cards.length - 1)) / cards.length;

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.setFillColor('#f9f9fd');
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.text(card.label.toUpperCase(), x + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    if (card.tone === 'ok') doc.setTextColor(...OK);
    else if (card.tone === 'danger') doc.setTextColor(...DANGER);
    else doc.setTextColor(INK);
    doc.text(card.value, x + 4, y + 13.5);
    if (card.hint) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text(card.hint, x + 4, y + 18.5, { maxWidth: cardW - 8 });
    }
    doc.setTextColor(INK);
  });
  return y + 28;
};

const sectionTitle = (doc: Doc, y: number, text: string) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(text, MARGIN, y);
  return y + 4;
};

const save = (doc: Doc, name: string) => doc.save(`${name}-${todayIso()}.pdf`);

/* ---------------------------------------------------------------
   Lista de compras
   --------------------------------------------------------------- */

export const exportShoppingList = async (
  list: ShoppingList,
  items: ShoppingItem[],
  rate: number,
  places: Place[],
): Promise<void> => {
  const { JsPDF, autoTable } = await loadPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });

  const place = list.placeId ? getRelationName(places, list.placeId, '') : '';
  header(doc, list.name, [place, list.status === 'abierta' ? 'Carpeta abierta' : 'Compra cerrada'].filter(Boolean).join(' · '));

  const inCart = items.filter((i) => i.checked);
  const spent = sum(inCart.map((i) => (i.actualUsd ?? i.estimatedUsd) * i.quantity));
  const planned = sum(items.map((i) => i.estimatedUsd * i.quantity));
  const plannedInCart = sum(inCart.map((i) => i.estimatedUsd * i.quantity));
  const diff = spent - plannedInCart;

  let y = statCards(doc, 34, [
    { label: 'Presupuestado', value: formatUsd(planned), hint: formatBs(toBs(planned, rate)) },
    { label: 'Pagado', value: formatUsd(spent), hint: formatBs(toBs(spent, rate)) },
    { label: 'Diferencia', value: `${diff > 0 ? '+' : ''}${formatUsd(diff)}`, hint: `${inCart.length} de ${items.length} productos`, tone: diff > 0 ? 'danger' : 'ok' },
    { label: list.budgetUsd > 0 ? 'Tope' : 'Sin tope', value: list.budgetUsd > 0 ? formatUsd(list.budgetUsd) : '—', hint: list.budgetUsd > 0 ? `Queda ${formatUsd(list.budgetUsd - spent)}` : undefined },
  ]);

  y = sectionTitle(doc, y, 'Productos');

  autoTable(doc, {
    startY: y,
    head: [['#', 'Producto', 'Cant.', 'Presupuestado', 'Pagado', 'Diferencia']],
    body: items.map((item, i) => {
      const est = item.estimatedUsd * item.quantity;
      const real = item.actualUsd !== undefined ? item.actualUsd * item.quantity : null;
      return [
        String(i + 1),
        item.name,
        `${item.quantity} ${item.unit}`,
        formatUsd(est),
        real !== null ? formatUsd(real) : 'Pendiente',
        real !== null ? `${real - est > 0 ? '+' : ''}${formatUsd(real - est)}` : '—',
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: PRIMARY, fontSize: 8 },
    alternateRowStyles: { fillColor: '#f9f9fd' },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`Tasa usada: ${formatBs(rate)} por dólar`, MARGIN, endY);

  save(doc, `lista-${list.name.toLowerCase().replace(/\s+/g, '-')}`);
};

/* ---------------------------------------------------------------
   Reporte de movimientos
   --------------------------------------------------------------- */

export interface MovementsReport {
  title: string;
  month: string;
  expenses: Expense[];
  incomes: Income[];
  categories: Category[];
  places: Place[];
  productName: (expense: Expense) => string;
  sourceName: (income: Income) => string;
  rate: number;
}

export const exportMovementsReport = async (report: MovementsReport): Promise<void> => {
  const { JsPDF, autoTable } = await loadPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });

  const expenseUsd = sum(report.expenses.map((e) => e.totalUsd));
  const incomeUsd = sum(report.incomes.filter((i) => i.owner === 'propio').map((i) => i.amountUsd));
  const balance = incomeUsd - expenseUsd;

  header(doc, 'Reporte de movimientos', `${report.title} · ${monthLabel(report.month)}`);

  let y = statCards(doc, 34, [
    { label: 'Ingresos propios', value: formatUsd(incomeUsd), hint: `${report.incomes.length} registros`, tone: 'ok' },
    { label: 'Gastos', value: formatUsd(expenseUsd), hint: `${report.expenses.length} registros` },
    { label: 'Balance', value: formatUsd(balance), hint: incomeUsd > 0 ? `${((balance / incomeUsd) * 100).toFixed(1)}% del ingreso` : undefined, tone: balance >= 0 ? 'ok' : 'danger' },
    { label: 'Tasa del reporte', value: formatBs(report.rate), hint: 'Bs por dólar' },
  ]);

  /* Gasto por rubro, con barra proporcional */
  const byCategory = new Map<string, number>();
  report.expenses.forEach((e) => byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.totalUsd));
  const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (ranked.length > 0) {
    y = sectionTitle(doc, y, 'A dónde se fue el dinero');
    y += 3;
    const maxUsd = ranked[0][1];
    const barMax = doc.internal.pageSize.getWidth() - MARGIN * 2 - 78;

    ranked.forEach(([categoryId, usd]) => {
      const name = getRelationName(report.categories, categoryId);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.text(name.slice(0, 22), MARGIN, y + 3);

      doc.setFillColor('#eeeef6');
      doc.roundedRect(MARGIN + 42, y, barMax, 4, 1, 1, 'F');
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(MARGIN + 42, y, Math.max(1, (usd / maxUsd) * barMax), 4, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.text(formatUsd(usd), doc.internal.pageSize.getWidth() - MARGIN, y + 3, { align: 'right' });
      doc.setTextColor(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.text(`${((usd / expenseUsd) * 100).toFixed(1)}%`, doc.internal.pageSize.getWidth() - MARGIN - 22, y + 3, { align: 'right' });
      y += 7;
    });
    y += 4;
  }

  /* Detalle de gastos */
  if (report.expenses.length > 0) {
    y = sectionTitle(doc, y, 'Gastos');
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Producto', 'Rubro', 'Lugar', 'Bs', 'USD']],
      body: report.expenses.map((e) => [
        shortDate(e.date),
        report.productName(e),
        getRelationName(report.categories, e.categoryId),
        getRelationName(report.places, e.placeId, '—'),
        formatBs(e.totalBs),
        formatUsd(e.totalUsd),
      ]),
      foot: [['', '', '', 'Total', '', formatUsd(expenseUsd)]],
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      headStyles: { fillColor: PRIMARY, fontSize: 7.5 },
      footStyles: { fillColor: '#f9f9fd', textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: '#f9f9fd' },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  /* Detalle de ingresos */
  if (report.incomes.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, y, 'Ingresos');
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Origen', 'Tipo', 'Dinero', 'Bs', 'USD']],
      body: report.incomes.map((i) => [
        shortDate(i.date),
        report.sourceName(i),
        (i.kind ?? 'variable') === 'fijo' ? 'Fijo' : 'Variable',
        i.owner,
        formatBs(i.amountBs),
        formatUsd(i.amountUsd),
      ]),
      foot: [['', '', '', 'Total propio', '', formatUsd(incomeUsd)]],
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      headStyles: { fillColor: OK, fontSize: 7.5 },
      footStyles: { fillColor: '#f9f9fd', textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: '#f9f9fd' },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  save(doc, 'movimientos');
};
