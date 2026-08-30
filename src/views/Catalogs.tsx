import { useState, type CSSProperties, type FormEvent } from 'react';
import { EyeOff, Plus, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import EmptyState from '../components/ui/EmptyState';
import type { BudgetGroup, CatalogItem, Category, Creditor, IncomeSource, Place } from '../types';
import type { CollectionName } from '../services/firestore';
import { CATALOG_COLORS, colorForIndex } from '../utils/relations';
import { GROUP_LABEL } from '../utils/finance';
import './Catalogs.css';

type CatalogKey = 'categories' | 'places' | 'creditors' | 'incomeSources';

const TABS: { key: CatalogKey; label: string; hint: string }[] = [
  { key: 'categories', label: 'Rubros', hint: 'Clasifican cada gasto y alimentan el presupuesto.' },
  { key: 'places', label: 'Lugares', hint: 'Comercios y servicios donde compras.' },
  { key: 'creditors', label: 'Acreedores', hint: 'Quién te financia: Cashea, Ubii, tiendas a cuotas.' },
  { key: 'incomeSources', label: 'Orígenes de ingreso', hint: 'Clientes, alquileres, Binance…' },
];

export default function Catalogs() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const [tab, setTab] = useState<CatalogKey>('categories');
  const editable = canEdit('catalogos');

  const items: CatalogItem[] = data[tab];
  const usage = (id: string): number => {
    if (tab === 'categories') return data.expenses.filter((e) => e.categoryId === id).length;
    if (tab === 'places') return data.expenses.filter((e) => e.placeId === id).length;
    if (tab === 'creditors') return data.debts.filter((d) => d.creditorId === id).length;
    return data.incomes.filter((i) => i.sourceId === id).length;
  };

  const remove = async (item: CatalogItem) => {
    const used = usage(item.id);
    if (used > 0) {
      await confirm({
        title: 'No se puede eliminar',
        message: `«${item.name}» está en ${used} registro(s). Desactívalo en vez de borrarlo para no romper el histórico.`,
        confirmLabel: 'Entendido', cancelLabel: 'Cerrar',
      });
      return;
    }
    const ok = await confirm({ title: `¿Eliminar «${item.name}»?`, confirmLabel: 'Eliminar', danger: true });
    if (ok) await data.del(tab as CollectionName, item.id);
  };

  const current = TABS.find((t) => t.key === tab);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Catálogos</h1><p className="page-subtitle">Las listas que alimentan los formularios. Un cambio aquí se refleja en toda la app.</p></div>
      </div>

      <div className="tabs tabs-scroll" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="num muted">{data[t.key].length}</span>
          </button>
        ))}
      </div>

      <section className="card">
        <p className="small muted cat-hint">{current?.hint}</p>
        {editable && <CatalogForm tab={tab} count={items.length} />}
        {items.length === 0 ? (
          <EmptyState title="Catálogo vacío" hint={editable ? 'Agrega el primero arriba, o impórtalos desde tu Excel.' : 'Aún no hay elementos.'} />
        ) : (
          <ul className="cat-list">
            {[...items].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
              <li key={item.id} className={`cat-row${item.active === false ? ' inactive' : ''}`}>
                <span className="dot" style={{ '--dot-color': item.color } as CSSProperties} />
                <span className="cat-name truncate">{item.name}</span>
                {tab === 'categories' && <CategoryFields category={item as Category} editable={editable} />}
                <span className="cat-usage tiny muted num">{usage(item.id)} usos</span>
                {editable && (
                  <span className="cat-actions">
                    <button type="button" className="btn btn-ghost btn-icon" title={item.active === false ? 'Reactivar' : 'Desactivar'} aria-label="Activar o desactivar" onClick={() => data.update<CatalogItem>(tab as CollectionName, item.id, { active: item.active === false })}><EyeOff size={15} /></button>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => void remove(item)}><Trash2 size={15} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CategoryFields({ category, editable }: { category: Category; editable: boolean }) {
  const { update } = useData();
  return (
    <>
      <select className="input cat-select" value={category.group} disabled={!editable} aria-label="Grupo"
        onChange={(e) => update<Category>('categories', category.id, { group: e.target.value as BudgetGroup })}>
        {(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
      </select>
      <input className="input cat-pct num" type="number" min="0" max="100" placeholder="%" disabled={!editable}
        value={category.suggestedPct ?? ''} aria-label="Porcentaje sugerido"
        onChange={(e) => update<Category>('categories', category.id, { suggestedPct: Number(e.target.value) || undefined })} />
    </>
  );
}

function CatalogForm({ tab, count }: { tab: CatalogKey; count: number }) {
  const { add } = useData();
  const [name, setName] = useState('');
  const [color, setColor] = useState(colorForIndex(count));
  const [group, setGroup] = useState<BudgetGroup>('necesidad');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (tab === 'categories') await add<Category>('categories', { name: name.trim(), color, active: true, group });
    else await add<Place | Creditor | IncomeSource>(tab, { name: name.trim(), color, active: true });
    setName('');
    setColor(colorForIndex(count + 1));
  };

  return (
    <form className="cat-form" onSubmit={submit}>
      <input className="input" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
      {tab === 'categories' && (
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value as BudgetGroup)} aria-label="Grupo">
          {(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
      )}
      <div className="cat-colors" role="radiogroup" aria-label="Color">
        {CATALOG_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c}
            className={`cat-color${color === c ? ' selected' : ''}`} style={{ '--swatch': c } as CSSProperties} onClick={() => setColor(c)} />
        ))}
      </div>
      <button type="submit" className="btn btn-primary"><Plus size={16} /> Agregar</button>
    </form>
  );
}
