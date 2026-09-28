import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, fmt, stdAt } from '../../lib/api.js';
import { useApp, puede } from '../../lib/store.jsx';
import { Spinner } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

const COLORES = ['#F37021', '#27AAE1', '#8E6CEF', '#3FA34D', '#E5484D'];

export default function Estandares() {
  const { user, aviso } = useApp();
  const [razas, setRazas] = useState(null);
  const [sel, setSel] = useState(0);
  const [puntos, setPuntos] = useState([]);
  const [meta, setMeta] = useState({});
  const cargar = () => api('/estandares').then(r => { setRazas(r); });
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (razas?.[sel]) { setPuntos(razas[sel].puntos.map(p => ({ ...p }))); setMeta({ fuente: razas[sel].fuente, por_validar: razas[sel].por_validar }); } }, [razas, sel]);
  if (!razas) return <Spinner />;
  const editable = puede(user, 'coordinacion');
  const curva = Array.from({ length: 43 }, (_, d) => Object.fromEntries([['dia', d], ...razas.map(r => [r.nombre, Math.round(stdAt(r.puntos, d))])]));
  const guardar = async () => {
    try { await api(`/estandares/${razas[sel].id}`, { method: 'PUT', body: { puntos: puntos.map(p => ({ dia: Number(p.dia), peso_g: p.peso_g === '' ? null : Number(p.peso_g), fcr: p.fcr === '' || p.fcr == null ? null : Number(p.fcr) })), ...meta } }); aviso('Estándar actualizado'); cargar(); }
    catch (e) { aviso(e.message, 'error'); }
  };
  const nueva = async () => {
    const nombre = prompt('Nombre de la línea genética (ej. Ross 308 AP):'); if (!nombre) return;
    try { await api('/razas', { method: 'POST', body: { nombre } }); await cargar(); setSel(razas.length); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <div>
      <Encabezado migas="Tablas maestras" titulo="Estándar genético por raza">{editable && <button className="btn-sec" onClick={nueva}><Plus size={17} />Nueva raza</button>}</Encabezado>
      <div className="card p-5 mb-4">
        <div className="font-extrabold mb-2">Curvas de peso estándar (g)</div>
        <div className="h-72"><ResponsiveContainer><LineChart data={curva} margin={{ left: -10 }}>
          <CartesianGrid stroke="#EEF1F2" /><XAxis dataKey="dia" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={v => `Día ${v}`} formatter={v => `${fmt(v)} g`} /><Legend wrapperStyle={{ fontSize: 12 }} />
          {razas.map((r, i) => <Line key={r.id} dataKey={r.nombre} stroke={COLORES[i % 5]} strokeWidth={3} dot={false} />)}
        </LineChart></ResponsiveContainer></div>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">{razas.map((r, i) => <button key={r.id} onClick={() => setSel(i)} className={`px-4 py-2 rounded-xl font-bold ${sel === i ? 'text-white' : 'bg-white text-carbon-600 shadow-card'}`} style={sel === i ? { background: COLORES[i % 5] } : {}}>{r.nombre}</button>)}</div>
      <div className="card p-5">
        {meta.por_validar && <div className="rounded-xl bg-desc-50 text-desc-700 p-3 text-sm font-semibold flex gap-2 mb-4"><AlertCircle size={18} className="shrink-0" />Valores por validar. Reemplácelos por la tabla oficial del proveedor genético que usa el cliente.</div>}
        <label className="block mb-4"><span className="label">Fuente</span><input className="input" value={meta.fuente || ''} disabled={!editable} onChange={e => setMeta({ ...meta, fuente: e.target.value })} /></label>
        <table className="w-full text-sm max-w-xl">
          <thead><tr><th className="th">Día</th><th className="th">Peso estándar (g)</th><th className="th">FCR estándar acumulado</th><th className="th"></th></tr></thead>
          <tbody>{puntos.map((p, i) => (
            <tr key={i} className="border-t border-carbon-100">
              {['dia', 'peso_g', 'fcr'].map(k => <td key={k} className="py-1.5 pr-2"><input className="input !py-1.5 num" disabled={!editable} value={p[k] ?? ''} onChange={e => setPuntos(puntos.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} /></td>)}
              <td>{editable && <button className="btn-ghost !p-1.5 text-mort-600" onClick={() => setPuntos(puntos.filter((_, j) => j !== i))}><Trash2 size={16} /></button>}</td>
            </tr>))}
          </tbody>
        </table>
        {editable && <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-sec" onClick={() => setPuntos([...puntos, { dia: '', peso_g: '', fcr: '' }])}><Plus size={17} />Agregar día</button>
          <label className="flex items-center gap-2 text-sm font-semibold px-3"><input type="checkbox" checked={!!meta.por_validar} onChange={e => setMeta({ ...meta, por_validar: e.target.checked })} />Por validar</label>
          <button className="btn-primary ml-auto" onClick={guardar}><Save size={17} />Guardar tabla</button>
        </div>}
        <p className="text-xs text-carbon-400 mt-3">Entre los días registrados el sistema interpola linealmente. Basta con cargar los días hito; si el proveedor entrega la tabla diaria completa, cárguela toda.</p>
      </div>
    </div>
  );
}
