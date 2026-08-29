import { useEffect, useState } from 'react';
import { fetchBcvRate } from '../services/rates';
import { useData } from '../hooks/useData';
import type { ExchangeRate } from '../types';

/** Consulta la tasa BCV del día y, si aún no está guardada, la persiste. */
export function useLiveRate() {
  const { ready, rates, set } = useData();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  useEffect(() => {
    if (!ready || status !== 'idle') return;
    setStatus('loading');
    fetchBcvRate().then((r) => {
      if (!r) { setStatus('error'); return; }
      const exists = rates.some((x) => x.date === r.date);
      const done = exists ? Promise.resolve() : set<ExchangeRate>('rates', r.date, { date: r.date, rate: r.rate, source: 'BCV' });
      done.then(() => setStatus('ok')).catch(() => setStatus('error'));
    });
  }, [ready, rates, set, status]);

  return status;
}
