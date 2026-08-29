import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import EmptyState from '../components/ui/EmptyState';
import Money from '../components/ui/Money';
import type { ShoppingItem, ShoppingPriority, StockUnit } from '../types';
import { UNITS } from '../utils/units';
import { formatUsd, sum } from '../utils/money';
import { todayIso } from '../utils/dates';
import './Shopping.css';

const PRIORITY_LABEL: Record<ShoppingPriority, string> = { urgente: 'Urgente', normal: 'Normal', cuando_se_pueda: 'Cuando se pueda' };
const PRIORITY_ORDER: ShoppingPriority[] = ['urgente', 'normal', 'cuando_se_pueda'];

export default function Shopping() {
  const { shopping, inventory, currentRate, add, update, del } = useData();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<StockUnit>('und');
  const [estimatedUsd, setEstimatedUsd] = useState('');
  const [priority, setPriority] = useState<ShoppingPriority>('normal');

  const pending = useMemo(() => shopping.filter((s) => !s.checked), [shopping]);
  const done = useMemo(() => shopping.filter((s) => s.checked), [shopping]);
  const totalUsd = sum(pending.map((s) => s.estimatedUsd * s.quantity));

  const onNameChange = (v: string) => {
    setName(v);
    const match = inventory.find((i) => i.name.toLowerCase() === v.trim().toLowerCase());
    if (match) { setEstimatedUsd(String(match.lastPriceUsd)); setUnit(match.unit); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const match = inventory.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
    await add<ShoppingItem>('shopping', { name: name.trim(), quantity: Number(quantity) || 1, unit, estimatedUsd: Number(estimatedUsd) || 0, priority, checked: false, inventoryItemId: match?.id, createdAt: todayIso() });
    setName(''); setQuantity('1'); setEstimatedUsd(''); setPriority('normal');
  };

  const toggle = (s: ShoppingItem) => update<ShoppingItem>('shopping', s.id, { checked: !s.checked });
  const clearDone = async () => { if (window.confirm(`¿Borrar ${done.length} comprados?`)) await Promise.all(done.map((s) => del('shopping', s.id))); };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Lista de compras</h1><p className="page-subtitle">Presupuesta antes de salir: la lista se suma en dólares y te dice cuántos bolívares llevar hoy.</p></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <span className="field-label">Costo estimado ({pending.length} ítems)</span>
          <Money amount={totalUsd} currency="USD" rate={currentRate} dual size="lg" />
          <span className="tiny muted">Precios tomados de tu última compra registrada.</span>
        </div>
        <form onSubmit={submit} className="card shop-form">
          <input className="input" placeholder="Producto" value={name} onChange={(e) => onNameChange(e.target.value)} list="shop-names" required />
          <datalist id="shop-names">{inventory.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          <div className="shop-form-row">
            <input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Cantidad" />
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} aria-label="Unidad">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            <input className="input num" type="number" step="0.01" min="0" placeholder="$ c/u" value={estimatedUsd} onChange={(e) => setEstimatedUsd(e.target.value)} aria-label="Precio estimado en dólares" />
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as ShoppingPriority)} aria-label="Prioridad">{PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>
          </div>
          <button type="submit" className="btn btn-primary"><Plus size={16} /> Agregar</button>
        </form>
      </div>

      <div className="card">
        {pending.length === 0 ? <EmptyState title="Lista vacía" hint="Agrega lo que falta o envía productos desde el inventario." /> : (
          PRIORITY_ORDER.map((p) => {
            const rows = pending.filter((s) => s.priority === p);
            if (rows.length === 0) return null;
            return (
              <section key={p} className="shop-group">
                <h3 className={`shop-group-title ${p}`}>{PRIORITY_LABEL[p]} <span className="muted num">· {formatUsd(sum(rows.map((s) => s.estimatedUsd * s.quantity)))}</span></h3>
                <ul>
                  {rows.map((s) => (
                    <li key={s.id} className="list-item">
                      <input type="checkbox" className="shop-check" checked={s.checked} onChange={() => toggle(s)} aria-label={`Comprado ${s.name}`} />
                      <div className="grow"><div className="strong truncate">{s.name}</div><div className="tiny muted num">{s.quantity} {s.unit} × {formatUsd(s.estimatedUsd)}</div></div>
                      <Money amount={s.estimatedUsd * s.quantity} currency="USD" rate={currentRate} dual size="sm" />
                      <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => del('shopping', s.id)}><Trash2 size={16} /></button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        {done.length > 0 && (
          <section className="shop-group">
            <div className="row-between"><h3 className="shop-group-title muted">Comprados ({done.length})</h3><button type="button" className="btn btn-ghost btn-sm" onClick={clearDone}>Limpiar</button></div>
            <ul>
              {done.map((s) => (
                <li key={s.id} className="list-item shop-done">
                  <input type="checkbox" className="shop-check" checked onChange={() => toggle(s)} aria-label={`Desmarcar ${s.name}`} />
                  <span className="grow truncate">{s.name}</span>
                </li>
              ))}
            </ul>
            <p className="tiny muted">Recuerda registrar la compra en Movimientos con "sumar al inventario" para actualizar precios y stock.</p>
          </section>
        )}
      </div>
    </div>
  );
}
