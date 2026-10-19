import { useMemo, useState, type FormEvent } from 'react';
import { Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useData } from '../../hooks/useData';
import CustomSelect from '../ui/CustomSelect';
import InvoiceScanButton from '../ui/InvoiceScanButton';
import type { ScannedInvoice } from '../../services/invoiceScan';
import type { Creditor, Debt, DebtGroup, DebtItem, MoneyOwner, NewDoc, PayStatus } from '../../types';
import { colorForIndex } from '../../utils/relations';
import { rateForDate } from '../../utils/finance';
import { formatBs, formatUsd, round2, sum } from '../../utils/money';
import { addDays, shortDate, todayIso } from '../../utils/dates';
import './forms.css';
import './DebtGroupForm.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };

interface ItemLine {
  key: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

const newKey = () => Math.random().toString(36).slice(2);
const emptyItem = (): ItemLine => ({ key: newKey(), name: '', quantity: '1', unitPrice: '' });
const toLine = (it: DebtItem): ItemLine => ({ key: newKey(), name: it.name, quantity: String(it.quantity), unitPrice: String(it.unitPriceUsd) });
const lineTotal = (l: ItemLine) => round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0));

interface ScheduleRow { dueDate: string; amountUsd: number }

/** Reparte el monto financiado en cuotas iguales; la última absorbe el redondeo. */
const buildSchedule = (financed: number, n: number, firstDue: string, everyDays: number): ScheduleRow[] => {
  if (financed <= 0 || n < 1) return [];
  const each = Math.floor((financed / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    dueDate: addDays(firstDue, i * everyDays),
    amountUsd: i === n - 1 ? round2(financed - each * (n - 1)) : each,
  }));
};

interface Props {
  /** Compra a editar; sin ella, se crea una nueva. */
  group?: DebtGroup;
  /** Cuotas actuales de la compra (solo al editar). */
  installments?: Debt[];
  onDone: () => void;
}

/**
 * Compra a cuotas en un solo registro: acreedor, productos (a mano o leídos de
 * la foto de la factura) y el calendario de cuotas que se genera a partir del
 * total. Al editar, si ya hay cuotas pagadas, el calendario queda bloqueado.
 */
export default function DebtGroupForm({ group, installments = [], onDone }: Props) {
  const data = useData();
  const ordered = useMemo(() => [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [installments]);
  const locked = ordered.some((d) => d.status === 'pagada');
  const initialItems = group?.items?.map(toLine) ?? [];
  const initialItemsSum = round2(sum(initialItems.map(lineTotal)));

  const [creditorId, setCreditorId] = useState(group?.creditorId ?? data.creditors[0]?.id ?? '');
  const [merchant, setMerchant] = useState(group?.merchant ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [date, setDate] = useState(group?.date ?? todayIso());
  const [invoiceNumber, setInvoiceNumber] = useState(group?.invoiceNumber ?? '');
  const [items, setItems] = useState<ItemLine[]>(initialItems);
  const [totalInput, setTotalInput] = useState(group ? String(group.totalUsd) : '');
  // El total sigue a la suma de productos hasta que se escribe a mano (o la factura trae otro, con IVA).
  const [totalTouched, setTotalTouched] = useState(group ? Math.abs(group.totalUsd - initialItemsSum) > 0.005 : false);
  const [downPayment, setDownPayment] = useState(group?.downPaymentUsd ? String(group.downPaymentUsd) : '');
  const [count, setCount] = useState(String(group?.installments ?? 1));
  const [everyDays, setEveryDays] = useState(String(group?.everyDays ?? 14));
  const [firstDue, setFirstDue] = useState(ordered[0]?.dueDate ?? todayIso());
  const [owner, setOwner] = useState<MoneyOwner>(group?.owner ?? 'propio');
  const [firstStatus, setFirstStatus] = useState<PayStatus>(ordered[0]?.status ?? 'pendiente');
  const [rate, setRate] = useState<number | undefined>(group?.rate);
  const [scanNote, setScanNote] = useState('');
  const [saving, setSaving] = useState(false);

  const itemsSum = round2(sum(items.map(lineTotal)));
  const total = round2(totalTouched || itemsSum === 0 ? Number(totalInput) || 0 : itemsSum);
  const down = round2(Number(downPayment) || 0);
  const financed = round2(Math.max(0, total - down));
  const n = Math.min(60, Math.max(1, Math.round(Number(count) || 1)));
  const step = Math.max(0, Number(everyDays) || 0);
  const schedule = locked
    ? ordered.map((d) => ({ dueDate: d.dueDate, amountUsd: d.amountUsd }))
    : buildSchedule(financed, n, firstDue, step);
  const valid = Boolean(merchant.trim() && creditorId && total > 0 && down < total);

  const updateItem = (key: string, patch: Partial<ItemLine>) =>
    setItems((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Vuelca lo leído de la foto en el formulario. Los bolívares pasan a dólares a la tasa de esa fecha. */
  const applyScan = (inv: ScannedInvoice) => {
    const scanDate = inv.date ?? date;
    const r = inv.currency === 'VES' ? rateForDate(data.rates, scanDate, data.currentRate) : undefined;
    const toUsd = (v: number) => (r ? round2(v / r) : round2(v));
    if (inv.merchant && !merchant.trim()) setMerchant(inv.merchant);
    if (inv.date) setDate(inv.date);
    if (inv.number) setInvoiceNumber(inv.number);
    const lines = inv.items.map((it) => ({
      key: newKey(), name: it.name, quantity: String(it.quantity),
      unitPrice: String(it.quantity ? toUsd(it.total / it.quantity) : toUsd(it.unitPrice)),
    }));
    setItems(lines);
    const linesSum = round2(sum(lines.map(lineTotal)));
    const printed = inv.total ? toUsd(inv.total) : 0;
    if (printed > 0 && Math.abs(printed - linesSum) > 0.01) {
      setTotalInput(String(printed));
      setTotalTouched(true);
    } else {
      setTotalInput(String(linesSum));
      setTotalTouched(false);
    }
    setRate(r);
    setScanNote(r
      ? `Montos en bolívares convertidos a ${formatBs(r)} por dólar${inv.total ? ` (factura: ${formatBs(inv.total)})` : ''}.`
      : '');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const cleanItems: DebtItem[] = items
        .filter((l) => l.name.trim() && lineTotal(l) > 0)
        .map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity) || 1, unitPriceUsd: round2(Number(l.unitPrice) || 0), totalUsd: lineTotal(l) }));
      const header = {
        // Strings vacíos (no undefined) para que al editar se pueda borrar el valor anterior.
        creditorId, merchant: merchant.trim(), description: description.trim(), owner,
      };
      const groupDoc: NewDoc<DebtGroup> = {
        ...header, date, invoiceNumber: invoiceNumber.trim(), items: cleanItems, rate,
        totalUsd: locked && group ? group.totalUsd : total,
        downPaymentUsd: locked && group ? group.downPaymentUsd : down,
        installments: locked ? ordered.length : n,
        everyDays: locked && group ? group.everyDays : step,
      };
      const newRows = (groupId: string): NewDoc<Debt>[] => schedule.map((s, i) => ({
        ...header, groupId, amountUsd: s.amountUsd, dueDate: s.dueDate,
        status: i === 0 ? firstStatus : 'pendiente',
        installment: schedule.length > 1 ? `${i + 1}/${schedule.length}` : undefined,
      }));

      if (!group) {
        const groupId = await data.add<DebtGroup>('debtGroups', groupDoc);
        await data.addMany<Debt>('debts', newRows(groupId));
        onDone();
        return;
      }

      await data.update<DebtGroup>('debtGroups', group.id, groupDoc);
      const sameSchedule = locked || (
        schedule.length === ordered.length
        && schedule.every((s, i) => s.dueDate === ordered[i].dueDate && s.amountUsd === ordered[i].amountUsd)
        && ordered[0]?.status === firstStatus
      );
      if (sameSchedule) {
        // Solo cambian datos de cabecera: se copian a cada cuota.
        await Promise.all(ordered.map((d) => data.update<Debt>('debts', d.id, header)));
      } else {
        // Sin cuotas pagadas se puede rehacer el calendario completo.
        await Promise.all(ordered.map((d) => data.del('debts', d.id)));
        await data.addMany<Debt>('debts', newRows(group.id));
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <InvoiceScanButton onScanned={applyScan} />

      <div className="form-grid">
        <div className="field"><span className="field-label">Acreedor</span>
          <CustomSelect items={data.creditors} value={creditorId} onChange={setCreditorId} placeholder="Cashea, Ubii, banco…"
            onCreate={(name) => data.add<Creditor>('creditors', { name, color: colorForIndex(data.creditors.length), active: true })} />
        </div>
        <label className="field"><span className="field-label">Tienda / concepto</span>
          <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Miniso, Maraplus…" required />
        </label>
      </div>
      <label className="field"><span className="field-label">Descripción</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha de compra</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field"><span className="field-label">Nº de factura</span>
          <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Opcional" />
        </label>
      </div>

      <div className="row-between">
        <span className="field-label">Productos {items.length > 0 && <span className="num">({items.length})</span>}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((c) => [...c, emptyItem()])}><Plus size={15} /> Agregar producto</button>
      </div>
      {items.length > 0 ? (
        <ul className="dg-items">
          {items.map((l) => (
            <li key={l.key} className="dg-item">
              <input className="input dg-item-name" value={l.name} onChange={(e) => updateItem(l.key, { name: e.target.value })} placeholder="Producto" aria-label="Producto" />
              <input className="input num" type="number" inputMode="decimal" step="any" min="0" value={l.quantity}
                onChange={(e) => updateItem(l.key, { quantity: e.target.value })} aria-label="Cantidad" placeholder="Cant." />
              <input className="input num" type="number" inputMode="decimal" step="0.01" min="0" value={l.unitPrice}
                onChange={(e) => updateItem(l.key, { unitPrice: e.target.value })} aria-label="Precio unitario en dólares" placeholder="Precio $" />
              <span className="dg-item-total num">{formatUsd(lineTotal(l))}</span>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar producto" onClick={() => setItems((c) => c.filter((x) => x.key !== l.key))}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="field-hint">Opcional: toma la foto de la factura o agrega los productos a mano.</p>}
      {scanNote && <p className="field-hint">{scanNote}</p>}

      {locked && (
        <p className="dg-locked tiny"><Lock size={14} /> Ya hay cuotas pagadas: el monto y el calendario no se pueden rehacer. Edita cada cuota desde el detalle.</p>
      )}
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto total ($)</span>
          <input className="input num" type="number" step="0.01" min="0" required disabled={locked}
            value={totalTouched || itemsSum === 0 ? totalInput : String(itemsSum)}
            onChange={(e) => { setTotalInput(e.target.value); setTotalTouched(true); }} />
          {totalTouched && itemsSum > 0 && Math.abs(itemsSum - total) > 0.005 && !locked && (
            <button type="button" className="btn btn-ghost btn-sm dg-sum-btn" onClick={() => setTotalTouched(false)}>
              <RotateCcw size={13} /> Usar suma de productos ({formatUsd(itemsSum)})
            </button>
          )}
        </label>
        <label className="field"><span className="field-label">Inicial pagada ($)</span>
          <input className="input num" type="number" step="0.01" min="0" value={downPayment} disabled={locked}
            onChange={(e) => setDownPayment(e.target.value)} placeholder="0" />
        </label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Nº de cuotas</span>
          <input className="input num" type="number" min="1" max="60" value={locked ? ordered.length : count} disabled={locked} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label className="field"><span className="field-label">Cada (días)</span>
          <input className="input num" type="number" min="0" value={everyDays} disabled={locked} onChange={(e) => setEveryDays(e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Primer vencimiento</span>
          <input className="input" type="date" value={firstDue} disabled={locked} onChange={(e) => setFirstDue(e.target.value)} required />
        </label>
        <label className="field"><span className="field-label">Dinero</span>
          <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}>
            <option value="propio">Propio</option><option value="tercero">De un tercero</option>
          </select>
        </label>
      </div>
      {!locked && (
        <label className="field"><span className="field-label">{n > 1 ? 'Estado de la 1ª cuota' : 'Estado'}</span>
          <select className="input" value={firstStatus} onChange={(e) => setFirstStatus(e.target.value as PayStatus)}>
            {(Object.keys(STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      )}

      {schedule.length > 0 && (
        <div className="dg-schedule">
          <p className="small">
            Un registro con <strong className="num">{schedule.length}</strong> cuota{schedule.length > 1 && 's'} · financiado <strong className="num">{formatUsd(locked ? sum(schedule.map((s) => s.amountUsd)) : financed)}</strong>
            {down > 0 && <> · inicial <span className="num">{formatUsd(down)}</span></>}
          </p>
          <ol className="dg-schedule-list">
            {schedule.map((s, i) => (
              <li key={s.dueDate + i}>
                <span className="muted num">{i + 1}</span>
                <span>{shortDate(s.dueDate)}</span>
                <span className="num strong">{formatUsd(s.amountUsd)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
          {saving ? 'Guardando…' : group ? 'Guardar cambios' : 'Guardar compra'}
        </button>
      </div>
    </form>
  );
}
