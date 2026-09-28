import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Truck, Save, Factory, Store } from 'lucide-react';
import { useApp } from '../../lib/store.jsx';
import { conPendientes, encolar, fmt, hoy, uuid } from '../../lib/api.js';
import { Campo, Vacio } from '../../components/ui.jsx';

export default function DespachoCampo() {
  const { id } = useParams();
  const nav = useNavigate();
  const { boot, outbox, aviso, online } = useApp();
  const lote = useMemo(() => conPendientes(boot?.lotes.find(l => l.id === Number(id)), outbox), [boot, outbox, id]);
  const [f, setF] = useState({ fecha: hoy(), destino: 'planta', planta_id: boot?.plantas?.[0]?.id || '', cliente: '', aves: '', kg_pie: '', placa: '', flete: '', observaciones: '' });
  if (!lote) return <Vacio titulo="Lote no disponible" />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });
  const aves = Number(f.aves) || 0, kg = Number(f.kg_pie) || 0;

  const guardar = async () => {
    if (!(aves > 0)) return aviso('Indique la cantidad de aves', 'error');
    if (aves > lote.resumen.saldo) return aviso(`Supera el saldo de aves (${fmt(lote.resumen.saldo)})`, 'error');
    if (!(kg > 0)) return aviso('Indique los kg netos en pie (báscula de granja)', 'error');
    if (f.destino === 'venta_pie' && !f.cliente) return aviso('Indique el cliente', 'error');
    await encolar('despacho', { id: uuid(), lote_id: lote.id, fecha: f.fecha, destino: f.destino, planta_id: f.destino === 'planta' ? Number(f.planta_id) : null,
      cliente: f.cliente || null, aves, kg_pie: kg, placa: f.placa || null, flete: f.flete ? Number(f.flete) : null, observaciones: f.observaciones || null });
    aviso(online ? 'Despacho registrado. Sincronizando…' : 'Despacho guardado en el teléfono.');
    nav(`/campo/lote/${lote.id}`, { replace: true });
  };

  return (
    <div className="-mx-4 -mt-4">
      <div className="bg-desp-500 text-white px-4 pt-3 pb-6 rounded-b-3xl">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 font-semibold opacity-90"><ArrowLeft size={18} />{lote.granja} · G{lote.galpon}</button>
        <div className="flex items-center gap-3 mt-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/20"><Truck size={26} /></span>
          <div><h1 className="text-2xl font-extrabold">Salida de aves</h1><div className="text-sm opacity-90">Pesaje en báscula de granja · saldo {fmt(lote.resumen.saldo)} aves</div></div>
        </div>
      </div>
      <div className="px-4 -mt-3 space-y-4">
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[['planta', 'Planta beneficiadora', Factory], ['venta_pie', 'Venta en pie', Store]].map(([v, t, I]) => (
              <button key={v} type="button" onClick={() => setF({ ...f, destino: v })} className={`rounded-2xl p-3 border-2 font-bold flex flex-col items-center gap-1 ${f.destino === v ? 'bg-desp-500 text-white border-transparent' : 'border-carbon-200 text-carbon-600'}`}><I size={22} />{t}</button>
            ))}
          </div>
          {f.destino === 'planta'
            ? <Campo label="Planta"><select className="input" value={f.planta_id} onChange={set('planta_id')}>{boot.plantas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
            : <Campo label="Cliente"><input className="input" value={f.cliente} onChange={set('cliente')} /></Campo>}
          <Campo label="Fecha de salida"><input type="date" className="input" max={hoy()} min={lote.fecha_entrada} value={f.fecha} onChange={set('fecha')} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Aves despachadas"><input className="input-big" inputMode="numeric" value={f.aves} onChange={e => setF({ ...f, aves: e.target.value.replace(/\D/g, '') })} /></Campo>
            <Campo label="Kg netos en pie"><input className="input-big" inputMode="decimal" value={f.kg_pie} onChange={e => setF({ ...f, kg_pie: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} /></Campo>
          </div>
          <div className="rounded-2xl bg-desp-50 p-4 text-sm flex justify-between"><span className="font-semibold">Peso promedio (auto)</span><b className="num">{aves && kg ? fmt(kg / aves, 3) + ' kg' : '—'}</b></div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Placa del vehículo"><input className="input uppercase" value={f.placa} onChange={set('placa')} /></Campo>
            <Campo label="Flete"><input className="input" inputMode="decimal" value={f.flete} onChange={set('flete')} /></Campo>
          </div>
          <Campo label="Observaciones"><textarea className="input" rows={2} value={f.observaciones} onChange={set('observaciones')} /></Campo>
        </div>
        <div className="sticky bottom-20 pb-2"><button className="btn btn-big bg-desp-500 text-white shadow-card" onClick={guardar}><Save size={22} />Registrar salida</button></div>
      </div>
    </div>
  );
}
