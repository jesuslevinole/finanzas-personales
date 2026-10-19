import { useState, type FormEvent } from 'react';
import { useData } from '../../hooks/useData';
import CustomSelect from '../ui/CustomSelect';
import type { Creditor, Debt, MoneyOwner, NewDoc, PayStatus } from '../../types';
import { colorForIndex } from '../../utils/relations';
import './forms.css';

const STATUS_LABEL: Record<PayStatus, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', pagada: 'Pagada' };

interface Props {
  debt: Debt;
  onDone: () => void;
}

/**
 * Edita una sola cuota. Si pertenece a una compra a cuotas, solo se tocan
 * monto, vencimiento y estado (acreedor y tienda se editan en la compra).
 * Las cuotas sueltas de antes de agrupar conservan todos sus campos.
 */
export default function InstallmentForm({ debt, onDone }: Props) {
  const data = useData();
  const grouped = Boolean(debt.groupId);
  const [creditorId, setCreditorId] = useState(debt.creditorId);
  const [merchant, setMerchant] = useState(debt.merchant);
  const [description, setDescription] = useState(debt.description ?? '');
  const [amountUsd, setAmountUsd] = useState(String(debt.amountUsd));
  const [dueDate, setDueDate] = useState(debt.dueDate);
  const [owner, setOwner] = useState<MoneyOwner>(debt.owner);
  const [status, setStatus] = useState<PayStatus>(debt.status);
  const [reference, setReference] = useState(debt.reference ?? '');
  const [saving, setSaving] = useState(false);

  const amt = Number(amountUsd) || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (amt <= 0 || (!grouped && (!merchant.trim() || !creditorId))) return;
    setSaving(true);
    try {
      const patch: Partial<NewDoc<Debt>> = grouped
        ? { amountUsd: amt, dueDate, status, reference: reference.trim() }
        : { creditorId, merchant: merchant.trim(), description: description.trim(), amountUsd: amt, dueDate, owner, status, reference: reference.trim() };
      await data.update<Debt>('debts', debt.id, patch);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      {!grouped && (
        <>
          <div className="form-grid">
            <div className="field"><span className="field-label">Acreedor</span>
              <CustomSelect items={data.creditors} value={creditorId} onChange={setCreditorId} placeholder="Cashea, Ubii, banco…"
                onCreate={(name) => data.add<Creditor>('creditors', { name, color: colorForIndex(data.creditors.length), active: true })} />
            </div>
            <label className="field"><span className="field-label">Tienda / concepto</span>
              <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} required />
            </label>
          </div>
          <label className="field"><span className="field-label">Descripción</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </>
      )}
      <div className="form-grid">
        <label className="field"><span className="field-label">Monto ($)</span>
          <input className="input num" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} required />
        </label>
        <label className="field"><span className="field-label">Vencimiento</span>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </label>
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PayStatus)}>
            {(Object.keys(STATUS_LABEL) as PayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        {grouped ? (
          <label className="field"><span className="field-label">Referencia</span>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Opcional" />
          </label>
        ) : (
          <label className="field"><span className="field-label">Dinero</span>
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as MoneyOwner)}>
              <option value="propio">Propio</option><option value="tercero">De un tercero</option>
            </select>
          </label>
        )}
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  );
}
