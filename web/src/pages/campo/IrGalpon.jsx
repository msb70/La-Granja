import { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApp } from '../../lib/store.jsx';
import { Spinner, Vacio } from '../../components/ui.jsx';

/** Destino de los QR pegados en cada galpón: abre directamente el lote activo */
export default function IrGalpon() {
  const { galponId } = useParams();
  const { boot, recargar, online } = useApp();
  const [listo, setListo] = useState(false);
  useEffect(() => { (online ? recargar().catch(() => {}) : Promise.resolve()).finally(() => setListo(true)); }, []); // eslint-disable-line
  if (!listo || !boot) return <Spinner texto="Abriendo galpón…" />;
  const ga = boot.galpones.find(g => g.id === Number(galponId));
  if (!ga) return <Vacio icon={Lock} titulo="Galpón no asignado" texto="Este código QR es de un galpón al que su usuario no tiene acceso. Pida a Coordinación que se lo asigne."><Link to="/campo" className="btn-primary mt-3">Ir a mis granjas</Link></Vacio>;
  const lote = boot.lotes.find(l => l.galpon_id === ga.id);
  return <Navigate to={lote ? `/campo/lote/${lote.id}` : `/campo/abrir/${ga.id}`} replace />;
}
