import { useEffect, useState } from 'react';
import { Save, History } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { Spinner, Campo } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

const METAS = [['mortalidad_pct', 'Mortalidad máxima de ciclo (%)'], ['fcr', 'Conversión alimenticia meta'], ['iee', 'Índice de Eficiencia Europeo meta'], ['peso_kg', 'Peso promedio a sacrificio (kg)'], ['edad_sacrificio', 'Edad de sacrificio (días)'], ['rendimiento_canal', 'Rendimiento canal (%)'], ['pollo_a_pct', 'Pollo tipo A (%)']];

export default function Configuracion() {
  const { aviso, recargar } = useApp();
  const [c, setC] = useState(null);
  const [aud, setAud] = useState([]);
  useEffect(() => { api('/config').then(setC); api('/auditoria').then(setAud).catch(() => {}); }, []);
  if (!c) return <Spinner />;
  const guardar = async () => {
    try {
      await api('/config', { method: 'PUT', body: { ...c, dias_hito: String(c.dias_hito).split(',').map(x => Number(x.trim())).filter(x => !Number.isNaN(x)), tolerancia_conciliacion: Number(c.tolerancia_conciliacion), ciclo_dias: Number(c.ciclo_dias), metas: Object.fromEntries(Object.entries(c.metas).map(([k, v]) => [k, Number(v)])) } });
      aviso('Configuración guardada'); recargar().catch(() => {});
    } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <div>
      <Encabezado migas="Administración" titulo="Configuración y metas"><button className="btn-primary" onClick={guardar}><Save size={17} />Guardar</button></Encabezado>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="font-extrabold">Metas productivas (proyectado)</div>
          {METAS.map(([k, t]) => <Campo key={k} label={t}><input className="input" inputMode="decimal" value={c.metas[k] ?? ''} onChange={e => setC({ ...c, metas: { ...c.metas, [k]: e.target.value } })} /></Campo>)}
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="font-extrabold">Reglas operativas</div>
            <Campo label="Días hito de pesaje obligatorio" ayuda="Separados por coma"><input className="input" value={Array.isArray(c.dias_hito) ? c.dias_hito.join(', ') : c.dias_hito} onChange={e => setC({ ...c, dias_hito: e.target.value })} /></Campo>
            <Campo label="Tolerancia de conciliación (%)"><input className="input" value={c.tolerancia_conciliacion} onChange={e => setC({ ...c, tolerancia_conciliacion: e.target.value })} /></Campo>
            <Campo label="Duración de referencia del ciclo (días)"><input className="input" value={c.ciclo_dias} onChange={e => setC({ ...c, ciclo_dias: e.target.value })} /></Campo>
            <div className="text-sm text-carbon-500">Fases ABA: {(c.fases_aba || []).map(f => `${f.nombre} (días ${f.desde}–${f.hasta > 900 ? '…' : f.hasta})`).join(' · ')}</div>
          </div>
          <div className="card p-5">
            <div className="font-extrabold flex items-center gap-2 mb-2"><History size={18} />Auditoría reciente</div>
            <div className="max-h-80 overflow-auto text-sm divide-y divide-carbon-100">
              {aud.map(a => <div key={a.id} className="py-1.5 flex justify-between gap-2"><span><b>{a.nombre || '—'}</b> · {a.accion.replace(/_/g, ' ')} {a.entidad_id && <span className="text-carbon-400">#{String(a.entidad_id).slice(0, 8)}</span>}</span><span className="text-carbon-400 whitespace-nowrap">{new Date(a.creado_en).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
