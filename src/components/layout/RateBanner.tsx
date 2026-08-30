import { TrendingUp } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { useLiveRate } from '../../hooks/useLiveRate';
import { formatBs, formatPct } from '../../utils/money';
import { addDays, shortDate } from '../../utils/dates';
import './RateBanner.css';

/** Cinta con la tasa BCV del día y cuánto se movió en la semana. Siempre visible. */
export default function RateBanner() {
  const { rates } = useData();
  const status = useLiveRate();
  const latest = rates[0];
  const weekAgo = rates.find((r) => r.date <= (latest ? addDays(latest.date, -7) : ''));
  const weekChange = latest && weekAgo ? latest.rate / weekAgo.rate - 1 : null;

  return (
    <div className="rate-banner">
      <span className="rate-banner-label">Tasa BCV</span>
      {latest ? (
        <>
          <span className="rate-banner-value num">{formatBs(latest.rate)}</span>
          <span className="rate-banner-date hide-mobile">{shortDate(latest.date)}</span>
          {weekChange !== null && (
            <span className={`tag ${weekChange > 0.01 ? 'danger' : 'ok'} hide-mobile`}>
              <TrendingUp size={12} /> {formatPct(weekChange)} / 7d
            </span>
          )}
        </>
      ) : (
        <span className="rate-banner-date">{status === 'loading' ? 'Consultando…' : 'Sin tasa registrada'}</span>
      )}
    </div>
  );
}


