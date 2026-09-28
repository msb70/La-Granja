import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search, Clock } from 'lucide-react';
import { api, descargar, fmt, fmtFecha } from '../../lib/api.js';
import { Semaforo, Estado, Spinner, Vacio, Barra } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

export default function Lotes() {
  const [lotes, setLotes] = useState(null);
  const [estado, setEstado] = useState('activo');
  const [q, setQ] = useState('');
  const [raza, setRaza] = useState('');
  useEffect(() => { api('/lotes').then(setLotes).catch(() => setLotes([])); }, []);
  const lista = useMemo(() => (lotes || []).filter(l => (!estado || l.estado === estado) && (!raza || l.raza === raza) &&
    (!q || `${l.granja} ${l.codigo}`.toLowerCase().includes(q.toLowerCase()))), [lotes, estado, q, raza]);
  if (!lotes) return <Spinner />;
  const razas = [...new Set(lotes.map(l => l.raza))];
  const cuenta = (e) => lotes.filter(l => !e || l.estado === e).length;

  return (
    <div>
      <Encabezado migas="Gestión · Lotes" titulo="Seguimiento de lotes">
        <button className="btn-sec" onClick={() => descargar('/reportes/lotes/excel' + (estado ? `?estado=${estado}` : ''))}><Download size={17} />Exportar</button>
      </Encabezado>
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-carbon-50 rounded-xl p-1">
          {[['activo', 'En curso'], ['discrepancia', 'Discrepancia'], ['cerrado', 'Cerrados'], ['', 'Todos']].map(([v, t]) => (
            <button key={v} onClick={() => setEstado(v)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${estado === v ? 'bg-white shadow text-jhs-600' : 'text-carbon-500'}`}>{t} <span className="text-carbon-400">{cuenta(v)}</span></button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-400" /><input className="input pl-9 !py-2" placeholder="Granja o código…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="input !w-auto !py-2" value={raza} onChange={e => setRaza(e.target.value)}><option value="">Todas las razas</option>{razas.map(r => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="card overflow-hidden">
        {!lista.length ? <Vacio titulo="No hay lotes con estos filtros" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-carbon-50"><tr>
                <th className="th">Lote</th><th className="th">Granja / galpón</th><th className="th">Raza</th><th className="th">Entrada</th><th className="th text-right">Día</th>
                <th className="th text-right">Aves vivas</th><th className="th text-right">Mort. %</th><th className="th text-right">Peso g</th><th className="th text-right">vs std</th>
                <th className="th text-right">FCR</th><th className="th text-right">IEE</th><th className="th w-32">% Cumpl.</th><th className="th">Estado</th>
              </tr></thead>
              <tbody>{lista.map(l => { const r = l.resumen; return (
                <tr key={l.id} className="border-t border-carbon-100 hover:bg-jhs-50/40">
                  <td className="td font-bold"><Link to={`/panel/lotes/${l.id}`} className="text-jhs-600 hover:underline">{l.codigo}</Link>{l.demo && <span className="chip bg-carbon-100 text-carbon-400 ml-1.5">demo</span>}</td>
                  <td className="td"><span className="font-semibold">{l.granja}</span> <span className="text-carbon-400">· G{l.galpon}</span>{l.granja_tipo === 'tercero' && <span className="chip bg-cielo-50 text-cielo-700 ml-1.5">3ro</span>}</td>
                  <td className="td">{l.raza}</td>
                  <td className="td">{fmtFecha(l.fecha_entrada)}</td>
                  <td className="td text-right font-bold">{r.dia_actual}</td>
                  <td className="td text-right">{fmt(l.estado === 'activo' ? r.saldo : r.aves_despachadas)}</td>
                  <td className="td text-right">{fmt(r.pct_mort, 2)}</td>
                  <td className="td text-right">{fmt(r.peso_g)}</td>
                  <td className={`td text-right font-semibold ${r.dif_peso_pct < -5 ? 'text-mort-600' : 'text-aba-600'}`}>{r.dif_peso_pct != null ? `${r.dif_peso_pct > 0 ? '+' : ''}${fmt(r.dif_peso_pct, 1)}%` : '—'}</td>
                  <td className="td text-right">{fmt(r.fcr, 2)}</td>
                  <td className="td text-right">{fmt(r.iee)}</td>
                  <td className="td"><div className="flex items-center gap-2"><div className="flex-1"><Barra valor={r.cumplimiento} color={r.semaforo === 'meta' ? 'bg-aba-500' : r.semaforo === 'vigilar' ? 'bg-desc-500' : 'bg-mort-500'} /></div><span className="font-bold text-xs w-9 text-right">{fmt(r.cumplimiento, 0)}%</span></div></td>
                  <td className="td"><div className="flex gap-1 items-center">{l.estado === 'activo' ? <Semaforo s={r.semaforo} /> : <Estado e={l.estado} />}{r.pendientes?.length > 0 && <Clock size={14} className="text-desc-600" title="Captura pendiente hoy" />}</div></td>
                </tr>); })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
