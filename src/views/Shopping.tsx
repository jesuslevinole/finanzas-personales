import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, FolderPlus, Mic, Plus, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useVoiceInput } from '../hooks/useVoiceInput';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import StatCard from '../components/ui/StatCard';
import Money from '../components/ui/Money';
import CustomSelect from '../components/ui/CustomSelect';
import DataTable, { type Column } from '../components/ui/DataTable';
import type { ShoppingItem, ShoppingList, ShoppingPriority, StockUnit } from '../types';
import { UNITS } from '../utils/units';
import { parseVoiceItem } from '../utils/voiceParse';
import { getRelationName } from '../utils/relations';
import { formatBs, formatPct, formatUsd, round2, sum, toUsd } from '../utils/money';
import { todayIso } from '../utils/dates';
import { sequenceMap } from '../utils/sequence';
import './Shopping.css';

const PRIORITY_LABEL: Record<ShoppingPriority, string> = { urgente: 'Urgente', normal: 'Normal', cuando_se_pueda: 'Cuando se pueda' };
const PRIORITY_ORDER: ShoppingPriority[] = ['urgente', 'normal', 'cuando_se_pueda'];

/** Precio real si ya se metió al carrito; si no, el estimado. */
const lineUsd = (item: ShoppingItem): number => (item.actualUsd ?? item.estimatedUsd) * item.quantity;

export default function Shopping() {
  const { shoppingLists } = useData();
  const [openListId, setOpenListId] = useState<string | null>(null);
  const list = shoppingLists.find((l) => l.id === openListId) ?? null;
  return list ? <ListDetail list={list} onBack={() => setOpenListId(null)} /> : <ListsOverview onOpen={setOpenListId} />;
}

/* ---------------- Carpetas ---------------- */

function ListsOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const data = useData();
  const { canEdit } = usePermissions();
  const editable = canEdit('compras');
  const [creating, setCreating] = useState(false);

  const loose = data.shopping.filter((s) => !s.listId);
  const openLists = data.shoppingLists.filter((l) => l.status === 'abierta');
  const closedLists = data.shoppingLists.filter((l) => l.status === 'cerrada');

  const statsOf = (list: ShoppingList) => {
    const items = data.shopping.filter((s) => s.listId === list.id);
    const spent = sum(items.filter((i) => i.checked).map(lineUsd));
    const planned = sum(items.map(lineUsd));
    return { items, spent, planned };
  };

  const removeList = (list: ShoppingList) => {
    const items = data.shopping.filter((s) => s.listId === list.id);
    if (!window.confirm(`¿Eliminar la carpeta «${list.name}» y sus ${items.length} productos?`)) return;
    items.forEach((i) => void data.del('shopping', i.id));
    void data.del('shoppingLists', list.id);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Lista de compras</h1><p className="page-subtitle">Una carpeta por salida: le pones tope, y al comprar vas cargando el precio real.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}><FolderPlus size={16} /> Nueva carpeta</button>}
      </div>

      {creating && editable && <NewListForm onDone={() => setCreating(false)} />}

      {openLists.length === 0 && closedLists.length === 0 && loose.length === 0 && (
        <div className="card"><EmptyState title="Sin carpetas" hint="Crea una carpeta con el nombre del comercio (Maraplus, Finca…) y su tope de gasto." /></div>
      )}

      {openLists.length > 0 && (
        <div className="grid grid-3">
          {openLists.map((list) => {
            const { items, spent, planned } = statsOf(list);
            const ratio = list.budgetUsd > 0 ? spent / list.budgetUsd : 0;
            return (
              <article key={list.id} className="shop-folder">
                <button type="button" className="shop-folder-open" onClick={() => onOpen(list.id)}>
                  <div className="row-between">
                    <span className="strong truncate">{list.name}</span>
                    <span className="tag primary">{items.filter((i) => i.checked).length}/{items.length}</span>
                  </div>
                  {list.placeId && <span className="tiny muted truncate">{getRelationName(data.places, list.placeId, '')}</span>}
                  <div className="shop-folder-figures">
                    <span className="num strong">{formatUsd(spent)}</span>
                    <span className="tiny muted">de {list.budgetUsd > 0 ? formatUsd(list.budgetUsd) : `${formatUsd(planned)} previstos`}</span>
                  </div>
                  {list.budgetUsd > 0 && <ProgressBar ratio={ratio} color={ratio > 1 ? 'var(--color-danger)' : ratio > 0.85 ? 'var(--color-warn)' : 'var(--color-ok)'} />}
                </button>
                {editable && (
                  <div className="shop-folder-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => data.update<ShoppingList>('shoppingLists', list.id, { status: 'cerrada', closedAt: todayIso() })}><Check size={14} /> Cerrar</button>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar carpeta" onClick={() => removeList(list)}><Trash2 size={15} /></button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {loose.length > 0 && (
        <section className="card">
          <div className="card-header"><h2 className="card-title">Sin carpeta</h2><span className="tag">{loose.length}</span></div>
          <p className="small muted shop-loose-hint">Productos sueltos (los de urgencias y los importados). Muévelos a una carpeta cuando planifiques la compra.</p>
          <ul className="shop-loose">
            {loose.map((s) => (
              <li key={s.id} className="shop-loose-item">
                <span className="truncate">{s.name}</span>
                <span className={`tag ${s.priority === 'urgente' ? 'danger' : ''}`}>{PRIORITY_LABEL[s.priority]}</span>
                <span className="num">{formatUsd(lineUsd(s))}</span>
                {editable && (
                  <select className="input shop-move" aria-label="Mover a carpeta" value=""
                    onChange={(e) => { if (e.target.value) void data.update<ShoppingItem>('shopping', s.id, { listId: e.target.value }); }}>
                    <option value="">Mover a…</option>
                    {openLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                {editable && <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => data.del('shopping', s.id)}><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {closedLists.length > 0 && (
        <section className="card">
          <div className="card-header"><h2 className="card-title">Compras cerradas</h2></div>
          <ul className="shop-loose">
            {closedLists.map((list) => {
              const { spent, items } = statsOf(list);
              return (
                <li key={list.id} className="shop-loose-item">
                  <button type="button" className="shop-closed-name truncate" onClick={() => onOpen(list.id)}>{list.name}</button>
                  <span className="tiny muted">{items.length} productos</span>
                  <span className="num strong">{formatUsd(spent)}</span>
                  {list.budgetUsd > 0 && <span className={`tag ${spent > list.budgetUsd ? 'danger' : 'ok'}`}>{formatPct(spent / list.budgetUsd)} del tope</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function NewListForm({ onDone }: { onDone: () => void }) {
  const data = useData();
  const [name, setName] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [budgetUsd, setBudgetUsd] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await data.add<ShoppingList>('shoppingLists', {
      name: name.trim(), placeId: placeId || undefined, budgetUsd: Number(budgetUsd) || 0,
      status: 'abierta', createdAt: todayIso(),
    });
    onDone();
  };

  return (
    <form className="card shop-newlist" onSubmit={submit}>
      <label className="field"><span className="field-label">Nombre de la carpeta</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maraplus, Finca, Farmacia…" required autoFocus /></label>
      <div className="field"><span className="field-label">Lugar (opcional)</span><CustomSelect items={data.places} value={placeId} onChange={setPlaceId} placeholder="Del catálogo" /></div>
      <label className="field"><span className="field-label">Máximo a gastar ($)</span><input className="input num" type="number" min="0" step="1" value={budgetUsd} onChange={(e) => setBudgetUsd(e.target.value)} placeholder="0 = sin tope" /></label>
      <button type="submit" className="btn btn-primary"><Plus size={16} /> Crear carpeta</button>
    </form>
  );
}

/* ---------------- Detalle de una carpeta ---------------- */

function ListDetail({ list, onBack }: { list: ShoppingList; onBack: () => void }) {
  const data = useData();
  const { canEdit } = usePermissions();
  const editable = canEdit('compras');
  const rate = data.currentRate;

  const items = useMemo(
    () => data.shopping.filter((s) => s.listId === list.id).sort((a, b) => Number(a.checked) - Number(b.checked) || PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)),
    [data.shopping, list.id],
  );

  const inCart = items.filter((i) => i.checked);
  const spent = sum(inCart.map(lineUsd));
  const pending = sum(items.filter((i) => !i.checked).map(lineUsd));
  const budget = list.budgetUsd;
  const ratio = budget > 0 ? spent / budget : 0;
  const remaining = budget - spent;

  const toggle = (item: ShoppingItem) => data.update<ShoppingItem>('shopping', item.id, { checked: !item.checked });

  const setPrice = (item: ShoppingItem, value: string, currency: 'VES' | 'USD') => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    const usd = currency === 'USD' ? n : round2(toUsd(n, rate));
    void data.update<ShoppingItem>('shopping', item.id, {
      actualUsd: usd,
      actualBs: currency === 'VES' ? n : round2(n * rate),
      checked: true,
    });
  };

  const seq = useMemo(() => sequenceMap(items, (i) => i.createdAt + i.name), [items]);

  const columns: Column<ShoppingItem>[] = [
    { key: 'seq', header: '#', width: '46px', render: (i) => <span className="seq num">{seq.get(i.id)}</span> },
    { key: 'check', header: '', width: '40px', render: (i) => (
      <input type="checkbox" className="shop-check" checked={i.checked} disabled={!editable} onChange={() => toggle(i)} aria-label={`En el carrito: ${i.name}`} onClick={(e) => e.stopPropagation()} />
    ) },
    { key: 'name', header: 'Producto', primary: true, render: (i) => (
      <span className={`truncate${i.checked ? ' shop-done-text' : ''}`}>{i.name}</span>
    ) },
    { key: 'qty', header: 'Cantidad', width: '110px', render: (i) => <span className="num muted">{i.quantity} {i.unit}</span> },
    { key: 'est', header: 'Estimado', align: 'end', width: '100px', hideOnMobile: true, render: (i) => <span className="muted">{formatUsd(i.estimatedUsd * i.quantity)}</span> },
    { key: 'real', header: 'Precio real', align: 'end', width: '170px', render: (i) => (
      editable
        ? <PriceInput item={i} rate={rate} onSet={setPrice} />
        : <span className="num">{i.actualUsd !== undefined ? formatUsd(i.actualUsd * i.quantity) : '—'}</span>
    ) },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="row">
          <button type="button" className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Volver"><ArrowLeft size={18} /></button>
          <div>
            <h1>{list.name}</h1>
            <p className="page-subtitle">{list.placeId ? getRelationName(data.places, list.placeId, '') : 'Carpeta de compra'} · {list.status === 'abierta' ? 'abierta' : 'cerrada'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <StatCard tone={ratio > 1 ? 'danger' : 'usd'} icon={<ShoppingBag size={18} />} label="Llevas en el carrito"
          value={<Money amount={spent} currency="USD" rate={rate} dual size="lg" align="start" />}
          hint={`${inCart.length} de ${items.length} productos`} />
        <StatCard tone={remaining < 0 ? 'danger' : 'ok'} icon={<Wallet size={18} />} label={budget > 0 ? 'Te queda del tope' : 'Sin tope definido'}
          value={<span className={`num ${remaining < 0 ? 'text-danger' : ''}`}>{budget > 0 ? formatUsd(remaining) : '—'}</span>}
          hint={budget > 0 ? `Tope: ${formatUsd(budget)} · ${formatBs(budget * rate)}` : 'Edita la carpeta para ponerle uno'} />
        <StatCard tone="warn" icon={<Plus size={18} />} label="Falta por agarrar"
          value={<span className="num">{formatUsd(pending)}</span>}
          hint={`Proyectado: ${formatUsd(spent + pending)}`} />
      </div>

      {budget > 0 && (
        <div className="card shop-budget">
          <div className="row-between small"><span className="strong">{formatPct(ratio)} del tope</span><span className="muted num">{formatBs(spent * rate)} de {formatBs(budget * rate)}</span></div>
          <ProgressBar ratio={ratio} color={ratio > 1 ? 'var(--color-danger)' : ratio > 0.85 ? 'var(--color-warn)' : 'var(--color-ok)'} />
          {ratio > 1 && <p className="tiny text-danger">Te pasaste {formatUsd(spent - budget)} del tope que te pusiste.</p>}
        </div>
      )}

      {editable && <AddItemForm listId={list.id} rate={rate} />}

      <div className="card card-tight">
        <DataTable rows={items} columns={columns} rowClass={(i) => (i.checked ? 'muted-row' : '')}
          actions={editable ? (i) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => data.del('shopping', i.id)}><Trash2 size={15} /></button> : undefined}
          empty={<EmptyState title="Carpeta vacía" hint="Agrega productos escribiendo o dictando: «dos kilos de harina 850 bolívares»." />} />
      </div>
    </div>
  );
}

/** Campo de precio real, en Bs o $, que marca el producto como tomado. */
function PriceInput({ item, rate, onSet }: { item: ShoppingItem; rate: number; onSet: (item: ShoppingItem, value: string, currency: 'VES' | 'USD') => void }) {
  const [currency, setCurrency] = useState<'VES' | 'USD'>('VES');
  const [value, setValue] = useState(item.actualBs !== undefined ? String(item.actualBs) : '');

  return (
    <span className="shop-price" onClick={(e) => e.stopPropagation()}>
      <input className="input num shop-price-input" type="number" min="0" step="0.01" value={value} placeholder={currency === 'VES' ? 'Bs' : '$'}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value) onSet(item, value, currency); }}
        aria-label={`Precio real de ${item.name}`} />
      <button type="button" className={`btn btn-outline shop-price-cur${currency === 'USD' ? ' usd' : ''}`}
        onClick={() => setCurrency((c) => (c === 'VES' ? 'USD' : 'VES'))} aria-label="Cambiar moneda">{currency === 'VES' ? 'Bs' : '$'}</button>
      {item.actualUsd !== undefined && <span className="tiny text-usd num">{formatUsd(item.actualUsd * item.quantity)}</span>}
      {item.actualUsd === undefined && rate > 0 && value && <span className="tiny muted num">≈ {formatUsd(currency === 'VES' ? toUsd(Number(value), rate) : Number(value))}</span>}
    </span>
  );
}

/** Alta de producto por escrito o dictado. */
function AddItemForm({ listId, rate }: { listId: string; rate: number }) {
  const data = useData();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<StockUnit>('und');
  const [estimatedUsd, setEstimatedUsd] = useState('');
  const [priority, setPriority] = useState<ShoppingPriority>('normal');
  const [heard, setHeard] = useState('');

  const fillFrom = (name: string) => {
    const match = data.inventory.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
    if (match) { setEstimatedUsd(String(match.lastPriceUsd)); setUnit(match.unit); }
  };

  const onVoice = (text: string) => {
    const parsed = parseVoiceItem(text);
    setHeard(text);
    setName(parsed.name);
    setQuantity(String(parsed.quantity));
    if (parsed.amount !== null) {
      const usd = parsed.currency === 'USD' ? parsed.amount : round2(toUsd(parsed.amount, rate));
      setEstimatedUsd(String(usd));
    } else {
      fillFrom(parsed.name);
    }
  };

  const { listening, supported, toggle } = useVoiceInput(onVoice);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const match = data.inventory.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
    await data.add<ShoppingItem>('shopping', {
      listId, name: name.trim(), quantity: Number(quantity) || 1, unit,
      estimatedUsd: Number(estimatedUsd) || 0, priority, checked: false,
      inventoryItemId: match?.id, createdAt: todayIso(),
    });
    setName(''); setQuantity('1'); setEstimatedUsd(''); setHeard('');
  };

  return (
    <form className="card shop-add" onSubmit={submit}>
      <div className="shop-add-main">
        <input className="input" placeholder="Producto" value={name} list="shop-names" required
          onChange={(e) => { setName(e.target.value); fillFrom(e.target.value); }} />
        {supported && (
          <button type="button" className={`btn btn-outline shop-mic${listening ? ' listening' : ''}`} onClick={toggle} aria-label="Dictar producto">
            <Mic size={16} /> {listening ? 'Escuchando…' : 'Dictar'}
          </button>
        )}
      </div>
      <datalist id="shop-names">{data.inventory.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      <div className="shop-add-row">
        <input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Cantidad" />
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} aria-label="Unidad">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <input className="input num" type="number" step="0.01" min="0" placeholder="$ c/u" value={estimatedUsd} onChange={(e) => setEstimatedUsd(e.target.value)} aria-label="Precio estimado" />
        <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as ShoppingPriority)} aria-label="Prioridad">
          {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <button type="submit" className="btn btn-primary"><Plus size={16} /> Agregar</button>
      </div>
      {heard && <p className="tiny muted">Escuché: «{heard}»</p>}
    </form>
  );
}
