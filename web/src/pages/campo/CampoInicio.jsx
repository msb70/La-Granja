import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Search, Warehouse, AlertTriangle, CheckCircle2, Clock, Bird } from 'lucide-react';
import { useApp } from '../../lib/store.jsx';
import { conPendientes, fmt, fmtFecha, hoy } from '../../lib/api.js';
import { Semaforo, Vacio } from '../../components/ui.jsx';

const saludo = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
const NOMBRE_TIPO = { mortalidad: 'Mortalidad', aba: 'Alimento', pesaje: 'Pesaje' };

export default function CampoInicio() {
  const { user, boot, outbox } = useApp();
  const [buscar, setBuscar] = useState('');
  const lotes = useMemo(() => (boot?.lotes || []).map(l => conPendientes(l, outbox)), [boot, outbox]);
  if (!boot) return <Vacio icon={Warehouse} titulo="Sin datos en este dispositivo" texto="Conéctese a internet una vez para descargar sus granjas y lotes." />;

  const galpones = boot.galpones.map(ga => ({ ...ga, granja: boot.granjas.find(g => g.id === ga.granja_id), lote: lotes.find(l => l.galpon_id === ga.id) }))
    .filter(ga => ga.granja && (!buscar || ga.granja.nombre.toLowerCase().includes(buscar.toLowerCase())))
    .sort((a, b) => (!!b.lote - !!a.lote) || a.granja.nombre.localeCompare(b.granja.nombre) || a.numero - b.numero);
  const conLote = galpones.filter(g => g.lote);
  const pendientesHoy = lotes.reduce((s, l) => s + l.resumen.pendientes.length, 0);
  const alertas = lotes.reduce((s, l) => s + l.resumen.alertas.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-carbon-500 font-semibold">{saludo()},</div>
        <h1 className="text-2xl font-extrabold">{user.nombre}</h1>
        <div className="text-sm text-carbon-400 capitalize">{fmtFecha(hoy(), { weekday: 'long', day: 'numeric', month: 'long' })} · {user.rol_nombre}</div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl p-3 bg-cielo-400 text-white"><Bird size={20} /><div className="text-2xl font-extrabold num mt-1">{conLote.length}</div><div className="text-xs font-semibold opacity-90">Lotes en curso</div></div>
        <div className={`rounded-2xl p-3 text-white ${pendientesHoy ? 'bg-desc-500' : 'bg-aba-500'}`}>{pendientesHoy ? <Clock size={20} /> : <CheckCircle2 size={20} />}<div className="text-2xl font-extrabold num mt-1">{pendientesHoy}</div><div className="text-xs font-semibold opacity-90">Capturas pendientes</div></div>
        <div className={`rounded-2xl p-3 text-white ${alertas ? 'bg-mort-500' : 'bg-carbon-400'}`}><AlertTriangle size={20} /><div className="text-2xl font-extrabold num mt-1">{alertas}</div><div className="text-xs font-semibold opacity-90">Alertas</div></div>
      </div>

      {boot.galpones.length > 6 && (
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-400" />
          <input className="input pl-10" placeholder="Buscar granja…" value={buscar} onChange={e => setBuscar(e.target.value)} />
        </div>
      )}

      <h2 className="label !mb-0 pt-1">Galpones asignados</h2>
      <div className="space-y-3">
        {galpones.map(ga => ga.lote ? (
          <Link key={ga.id} to={`/campo/lote/${ga.lote.id}`} className="card block p-4 active:scale-[.99] transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-extrabold text-lg leading-tight truncate">{ga.granja.nombre} <span className="text-jhs-500">· G{ga.numero}</span></div>
                <div className="text-sm text-carbon-500">{ga.lote.codigo} · {ga.lote.raza}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-bold uppercase text-carbon-400">Día</div>
                <div className="text-3xl font-extrabold num text-jhs-500 leading-none">{ga.lote.resumen.dia_actual}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="rounded-xl bg-cielo-50 py-2"><div className="font-extrabold num">{fmt(ga.lote.resumen.saldo)}</div><div className="text-[10px] font-bold text-cielo-700 uppercase">Aves vivas</div></div>
              <div className="rounded-xl bg-mort-50 py-2"><div className="font-extrabold num">{fmt(ga.lote.resumen.pct_mort, 2)}%</div><div className="text-[10px] font-bold text-mort-700 uppercase">Mortalidad</div></div>
              <div className="rounded-xl bg-peso-50 py-2"><div className="font-extrabold num">{fmt(ga.lote.resumen.peso_g)} g</div><div className="text-[10px] font-bold text-peso-700 uppercase">Peso d{ga.lote.resumen.dia_peso ?? '—'}</div></div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex flex-wrap gap-1.5">
                {ga.lote.resumen.pendientes.length
                  ? ga.lote.resumen.pendientes.map(t => <span key={t} className="chip bg-desc-100 text-desc-700"><Clock size={11} />{NOMBRE_TIPO[t]}</span>)
                  : <span className="chip bg-aba-100 text-aba-700"><CheckCircle2 size={11} />Día completo</span>}
                {ga.lote.pendientesLocales > 0 && <span className="chip bg-carbon-100 text-carbon-600">{ga.lote.pendientesLocales} por enviar</span>}
              </div>
              <ChevronRight className="text-carbon-300" />
            </div>
          </Link>
        ) : (
          <div key={ga.id} className="card p-4 flex items-center justify-between border-dashed">
            <div>
              <div className="font-bold">{ga.granja.nombre} · G{ga.numero}</div>
              <div className="text-sm text-carbon-400">Sin lote activo</div>
            </div>
            {['galponero', 'productor', 'coordinacion', 'admin'].includes(user.rol)
              ? <Link to={`/campo/abrir/${ga.id}`} className="btn-sec text-jhs-600"><Plus size={18} />Abrir lote</Link>
              : <Semaforo s="—" />}
          </div>
        ))}
        {!galpones.length && <Vacio icon={Warehouse} titulo="No hay galpones" texto="Pida a Coordinación que le asigne granjas." />}
      </div>
      <p className="text-center text-xs text-carbon-400 pb-2">Datos del {fmtFecha(boot.generado_en.slice(0, 10))} {new Date(boot.generado_en).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  );
}
