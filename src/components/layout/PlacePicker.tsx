import { MapPin } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { useCurrentPlace } from '../../hooks/useCurrentPlace';
import { activeOnly } from '../../utils/relations';
import './PlacePicker.css';

/** Selector de «dónde estoy»: precarga el lugar en los formularios de gasto. */
export default function PlacePicker() {
  const { places } = useData();
  const { placeId, setPlace } = useCurrentPlace();

  return (
    <label className={`placepicker${placeId ? ' active' : ''}`}>
      <MapPin size={15} />
      <span className="sr-only">Lugar donde estás</span>
      <select className="placepicker-select" value={placeId} onChange={(e) => setPlace(e.target.value)}>
        <option value="">¿Dónde estás?</option>
        {activeOnly(places).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}
