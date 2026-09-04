import { shortDate, todayIso } from './dates';

/* ---------------------------------------------------------------
   Generador de reportes en PDF.
   Todas las vistas arman la misma estructura —tarjetas, barras y
   tablas— y este módulo se encarga de dibujarla.
   --------------------------------------------------------------- */

export interface ReportCard {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'danger' | 'warn';
}

export interface ReportBar {
  label: string;
  /** Valor numérico para el largo de la barra. */
  value: number;
  /** Texto que se muestra a la derecha (ya formateado). */
  display: string;
  /** Segundo texto, normalmente el porcentaje. */
  note?: string;
}

export interface ReportTable {
  title?: string;
  head: string[];
  body: string[][];
  foot?: string[][];
  /** Índices de columna alineados a la derecha. */
  alignRight?: number[];
  accent?: 'primary' | 'ok' | 'danger';
}

export interface ReportSpec {
  title: string;
  subtitle: string;
  /** Nombre del archivo, sin fecha ni extensión. */
  fileName: string;
  cards?: ReportCard[];
  bars?: { title: string; items: ReportBar[] };
  tables?: ReportTable[];
  /** Nota final, por ejemplo la tasa usada. */
  footNote?: string;
}

const INK = '#14122b';
const MUTED = '#6b6f85';
const SOFT = '#f9f9fd';
type Rgb = [number, number, number];

const TONES: Record<'primary' | 'ok' | 'danger' | 'warn', Rgb> = {
  primary: [91, 61, 245],
  ok: [15, 138, 95],
  danger: [220, 38, 38],
  warn: [232, 139, 10],
};

const MARGIN = 14;

/** jsPDF pesa bastante: se carga solo cuando se exporta. */
const loadPdf = async () => {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { JsPDF, autoTable };
};

type Doc = import('jspdf').jsPDF;

const finalY = (doc: Doc): number => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export const exportReport = async (spec: ReportSpec): Promise<void> => {
  const { JsPDF, autoTable } = await loadPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  /* Cabecera */
  doc.setFillColor(TONES.primary[0], TONES.primary[1], TONES.primary[2]);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(spec.title, MARGIN, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(spec.subtitle, MARGIN, 19, { maxWidth: pageW - MARGIN * 2 - 45 });
  doc.text(`Generado el ${shortDate(todayIso())}`, pageW - MARGIN, 19, { align: 'right' });
  doc.setTextColor(INK);

  let y = 34;

  /* Tarjetas de cifras */
  if (spec.cards && spec.cards.length > 0) {
    const cards = spec.cards.slice(0, 4);
    const gap = 4;
    const cardW = (pageW - MARGIN * 2 - gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, i) => {
      const x = MARGIN + i * (cardW + gap);
      doc.setFillColor(SOFT);
      doc.roundedRect(x, y, cardW, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text(card.label.toUpperCase(), x + 4, y + 6, { maxWidth: cardW - 8 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      const tone: Rgb = card.tone ? TONES[card.tone] : [20, 18, 43];
      doc.setTextColor(tone[0], tone[1], tone[2]);
      doc.text(card.value, x + 4, y + 13.5, { maxWidth: cardW - 8 });
      if (card.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(MUTED);
        doc.text(card.hint, x + 4, y + 18.5, { maxWidth: cardW - 8 });
      }
      doc.setTextColor(INK);
    });
    y += 28;
  }

  /* Barras proporcionales */
  if (spec.bars && spec.bars.items.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(spec.bars.title, MARGIN, y);
    y += 7;

    const max = Math.max(...spec.bars.items.map((b) => b.value), 1);
    const barMax = pageW - MARGIN * 2 - 78;
    spec.bars.items.slice(0, 10).forEach((bar) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.text(bar.label.slice(0, 22), MARGIN, y + 3);
      doc.setFillColor('#eeeef6');
      doc.roundedRect(MARGIN + 42, y, barMax, 4, 1, 1, 'F');
      doc.setFillColor(TONES.primary[0], TONES.primary[1], TONES.primary[2]);
      doc.roundedRect(MARGIN + 42, y, Math.max(1, (bar.value / max) * barMax), 4, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(bar.display, pageW - MARGIN, y + 3, { align: 'right' });
      if (bar.note) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(MUTED);
        doc.text(bar.note, pageW - MARGIN - 24, y + 3, { align: 'right' });
      }
      y += 7;
    });
    y += 4;
  }

  /* Tablas */
  (spec.tables ?? []).forEach((table) => {
    if (table.body.length === 0) return;
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    if (table.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(INK);
      doc.text(table.title, MARGIN, y);
      y += 4;
    }
    const alignRight = Object.fromEntries((table.alignRight ?? []).map((i) => [i, { halign: 'right' as const }]));
    autoTable(doc, {
      startY: y,
      head: [table.head],
      body: table.body,
      foot: table.foot,
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: TONES[table.accent ?? 'primary'], fontSize: 7.5 },
      footStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: alignRight,
      margin: { left: MARGIN, right: MARGIN },
    });
    y = finalY(doc) + 8;
  });

  if (spec.footNote) {
    if (y > pageH - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(spec.footNote, MARGIN, y, { maxWidth: pageW - MARGIN * 2 });
  }

  /* Numeración de páginas */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.text(`Bolívar Vivo · página ${i} de ${pages}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  doc.save(`${spec.fileName}-${todayIso()}.pdf`);
};
