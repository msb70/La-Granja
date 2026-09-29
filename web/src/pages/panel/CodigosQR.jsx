import { useEffect, useMemo, useState } from 'react';
import { Printer, Smartphone, QrCode } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Spinner, Logo } from '../../components/ui.jsx';
import QR, { urlGalpon } from '../../components/QR.jsx';
import { Encabezado } from './PanelLayout.jsx';

export default function CodigosQR() {
  const [granjas, setGranjas] = useState(null);
  const [sel, setSel] = useState('');
  useEffect(() => { api('/granjas').then(setGranjas); }, []);
  const lista = useMemo(() => (granjas || []).filter(g => g.activo && (!sel || g.id === Number(sel))), [granjas, sel]);
  if (!granjas) return <Spinner />;
  const app = window.location.origin;
  const galpones = lista.flatMap(g => (g.lista_galpones || []).filter(x => x.activo).map(x => ({ ...x, granja: g.nombre })));

  return (
    <div>
      <Encabezado migas="Campo · Acceso rápido" titulo="Códigos QR">
        <select className="input !w-auto" value={sel} onChange={e => setSel(e.target.value)}><option value="">Todas las granjas</option>{granjas.filter(g => g.activo).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={17} />Imprimir</button>
      </Encabezado>

      <div className="card p-5 mb-6 flex flex-col sm:flex-row gap-5 items-center no-print">
        <div className="rounded-2xl bg-white p-3 border border-carbon-100"><QR texto={app} size={170} /></div>
        <div>
          <div className="flex items-center gap-2 font-extrabold text-lg"><Smartphone className="text-jhs-500" />Abrir la app en el teléfono</div>
          <p className="text-carbon-600 mt-1 max-w-lg">Escanee con la cámara del teléfono, inicie sesión y elija <b>«Agregar a pantalla de inicio»</b> (iPhone: botón Compartir; Android: menú ⋮ → Instalar app). Queda como una aplicación y funciona sin señal.</p>
          <div className="text-sm text-carbon-400 mt-2 break-all">{app}</div>
        </div>
      </div>

      <div className="mb-3 no-print"><div className="flex items-center gap-2"><QrCode size={18} className="text-jhs-500" /><span className="font-extrabold">QR por galpón</span></div><p className="text-sm text-carbon-500 mt-1">— imprima y péguelos en la entrada de cada galpón. Al escanearlo se abre directamente el lote activo para capturar.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-3 print:gap-3">
        {galpones.map(ga => (
          <div key={ga.id} className="card p-4 flex flex-col items-center text-center break-inside-avoid print:border-2 print:border-carbon-800">
            <div className="w-full rounded-xl bg-jhs-500 text-white py-2 px-2 mb-3 flex items-center justify-center gap-2 print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]"><Logo className="h-4 shrink-0" /><span className="font-extrabold text-xs whitespace-nowrap">El Dorado</span></div>
            <QR texto={urlGalpon(ga.id)} size={150} />
            <div className="font-extrabold text-lg leading-tight mt-2">{ga.granja}</div>
            <div className="text-3xl font-extrabold text-jhs-500">Galpón {ga.numero}</div>
            <div className="text-[11px] text-carbon-400 mt-1">Escanee para registrar mortalidad, alimento y pesaje</div>
          </div>
        ))}
      </div>
    </div>
  );
}
