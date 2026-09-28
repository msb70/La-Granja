import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory, Store, Truck } from 'lucide-react';
import { api, fmt, fmtFecha, hoy } from '../../lib/api.js';
import { useApp, puede } from '../../lib/store.jsx';
import { Spinner, Modal, Campo, Vacio, Stat } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

export function RecepcionForm({ d, onOk }) {
  const { aviso } = useApp();
  const [f, setF] = useState({ fecha: d.fecha_beneficio || hoy(), aves_recibidas: d.aves_recibidas ?? d.aves, aves_muertas: d.aves_muertas ?? 0, kg_recibidos: d.kg_recibidos ?? '', und_tipo_a: d.und_tipo_a ?? '', kg_tipo_a: d.kg_tipo_a ?? '', und_tipo_b: d.und_tipo_b ?? '', kg_tipo_b: d.kg_tipo_b ?? '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const benef = (Number(f.kg_tipo_a) || 0) + (Number(f.kg_tipo_b) || 0);
  const ok = async () => {
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === 'fecha' ? v : v === '' ? null : Number(v)]));
    try { await api(`/despachos/${d.id}/beneficio`, { method: 'POST', body }); aviso('Recepción registrada'); onOk(); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-desp-50 p-3 text-sm"><b>Despachado:</b> {fmt(d.aves)} aves · {fmt(d.kg_pie, 1)} kg en pie · {fmtFecha(d.fecha)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha de beneficio"><input type="date" className="input" value={f.fecha} onChange={set('fecha')} /></Campo>
        <Campo label="Aves recibidas (total)"><input className="input" inputMode="numeric" value={f.aves_recibidas} onChange={set('aves_recibidas')} /></Campo>
        <Campo label="De ellas, muertas en transporte"><input className="input" inputMode="numeric" value={f.aves_muertas} onChange={set('aves_muertas')} /></Campo>
        <Campo label="Kg recibidos en planta"><input className="input" inputMode="decimal" value={f.kg_recibidos} onChange={set('kg_recibidos')} /></Campo>
        <Campo label="Unidades tipo A"><input className="input" inputMode="numeric" value={f.und_tipo_a} onChange={set('und_tipo_a')} /></Campo>
        <Campo label="Kg pollo tipo A"><input className="input" inputMode="decimal" value={f.kg_tipo_a} onChange={set('kg_tipo_a')} /></Campo>
        <Campo label="Unidades tipo B"><input className="input" inputMode="numeric" value={f.und_tipo_b} onChange={set('und_tipo_b')} /></Campo>
        <Campo label="Kg pollo tipo B"><input className="input" inputMode="decimal" value={f.kg_tipo_b} onChange={set('kg_tipo_b')} /></Campo>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-carbon-50 p-3">Merma transporte: <b>{f.kg_recibidos ? fmt(d.kg_pie - f.kg_recibidos, 1) + ' kg' : '—'}</b></div>
        <div className={`rounded-xl p-3 ${benef && benef / d.kg_pie * 100 < 92 ? 'bg-desc-50' : 'bg-aba-50'}`}>Rendimiento canal: <b>{benef ? fmt(benef / d.kg_pie * 100, 1) + '%' : '—'}</b> (meta 92%)</div>
      </div>
      <button className="btn-primary w-full" onClick={ok}>Guardar recepción</button>
    </div>
  );
}

export default function Despachos() {
  const { user } = useApp();
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const cargar = () => api('/despachos').then(setRows).catch(() => setRows([]));
  useEffect(() => { cargar(); }, []);
  if (!rows) return <Spinner />;
  const planta = rows.filter(r => r.destino === 'planta');
  const pendientes = planta.filter(r => r.aves_recibidas == null);
  const kgPie = planta.filter(r => r.kg_tipo_a != null).reduce((s, r) => s + Number(r.kg_pie), 0);
  const kgBenef = planta.filter(r => r.kg_tipo_a != null).reduce((s, r) => s + Number(r.kg_tipo_a || 0) + Number(r.kg_tipo_b || 0), 0);
  const kgA = planta.reduce((s, r) => s + Number(r.kg_tipo_a || 0), 0), kgB = planta.reduce((s, r) => s + Number(r.kg_tipo_b || 0), 0);
  return (
    <div>
      <Encabezado migas="Logística" titulo="Despachos y planta beneficiadora" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={Truck} tono="desp" label="Aves despachadas" value={fmt(rows.reduce((s, r) => s + r.aves, 0))} sub={`${rows.length} despachos`} />
        <Stat icon={Factory} tono="desc" label="Recepciones pendientes" value={pendientes.length} sub="Despachos a planta sin recepción" />
        <Stat tono="aba" label="Rendimiento canal" value={kgPie ? `${fmt(kgBenef / kgPie * 100, 1)}%` : '—'} sub="Meta 92%" />
        <Stat tono="peso" label="% Pollo tipo A" value={kgA + kgB ? `${fmt(kgA / (kgA + kgB) * 100, 1)}%` : '—'} sub="Meta 95%" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-carbon-50"><tr>{['Fecha', 'Granja', 'Lote', 'Destino', 'Aves', 'Kg pie', 'P. prom', 'Recibidas', 'Dif. aves', 'Merma kg', 'Rend.', ''].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map(r => {
            const benef = Number(r.kg_tipo_a || 0) + Number(r.kg_tipo_b || 0);
            return (
              <tr key={r.id} className="border-t border-carbon-100">
                <td className="td">{fmtFecha(r.fecha)}</td><td className="td font-semibold">{r.granja} G{r.galpon}</td>
                <td className="td"><Link to={`/panel/lotes/${r.lote_id}`} className="text-jhs-600 font-bold">{r.codigo}</Link></td>
                <td className="td">{r.destino === 'planta' ? <span className="chip bg-desp-50 text-desp-700"><Factory size={12} />{r.planta}</span> : <span className="chip bg-cielo-50 text-cielo-700"><Store size={12} />{r.cliente}</span>}</td>
                <td className="td">{fmt(r.aves)}</td><td className="td">{fmt(r.kg_pie, 1)}</td><td className="td">{fmt(r.kg_pie / r.aves, 3)}</td>
                <td className="td font-bold">{r.destino === 'planta' ? (r.aves_recibidas != null ? fmt(r.aves_recibidas) : <span className="chip bg-desc-100 text-desc-700">Pendiente</span>) : '—'}</td>
                <td className="td">{r.aves_recibidas != null ? fmt(r.aves - r.aves_recibidas) : ''}</td>
                <td className="td">{r.kg_recibidos != null ? fmt(r.kg_pie - r.kg_recibidos, 1) : ''}</td>
                <td className="td font-bold">{benef ? fmt(benef / r.kg_pie * 100, 1) + '%' : ''}</td>
                <td className="td">{r.destino === 'planta' && puede(user, 'coordinacion') && <button className="btn-sec !py-1 !px-2 text-xs" onClick={() => setSel(r)}>{r.aves_recibidas == null ? 'Registrar recepción' : 'Editar'}</button>}</td>
              </tr>);
          })}</tbody>
        </table>
        {!rows.length && <Vacio icon={Truck} titulo="Aún no hay despachos" />}
      </div>
      <Modal abierto={!!sel} onClose={() => setSel(null)} titulo="Recepción en planta beneficiadora">{sel && <RecepcionForm d={sel} onOk={() => { setSel(null); cargar(); }} />}</Modal>
    </div>
  );
}
