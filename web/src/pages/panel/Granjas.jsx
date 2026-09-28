import { useEffect, useState } from 'react';
import { Plus, Warehouse, MapPin, Pencil, AlertCircle } from 'lucide-react';
import { api, fmt } from '../../lib/api.js';
import { useApp, puede } from '../../lib/store.jsx';
import { Spinner, Modal, Campo, Stat } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

export default function Granjas() {
  const { user, aviso, recargar } = useApp();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [filtro, setFiltro] = useState('');
  const cargar = () => api('/granjas').then(setRows);
  useEffect(() => { cargar(); }, []);
  if (!rows) return <Spinner />;
  const editable = puede(user, 'coordinacion');
  const guardar = async () => {
    try { await api('/granjas', { method: 'POST', body: edit }); aviso('Granja guardada'); setEdit(null); cargar(); recargar().catch(() => {}); } catch (e) { aviso(e.message, 'error'); }
  };
  const agregarGalpon = async (g) => {
    const n = Math.max(0, ...(g.lista_galpones || []).map(x => x.numero)) + 1;
    try { await api('/galpones', { method: 'POST', body: { granja_id: g.id, numero: n } }); aviso(`Galpón ${n} agregado`); cargar(); recargar().catch(() => {}); } catch (e) { aviso(e.message, 'error'); }
  };
  const lista = rows.filter(g => !filtro || g.tipo === filtro || (filtro === 'validar' && g.por_validar));
  return (
    <div>
      <Encabezado migas="Gestión · Granjas" titulo="Granjas y galpones">
        {editable && <button className="btn-primary" onClick={() => setEdit({ nombre: '', tipo: 'propia', ubicacion: '', supervisor: '', galpones: 1 })}><Plus size={18} />Nueva granja</button>}
      </Encabezado>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={Warehouse} tono="jhs" label="Granjas registradas" value={rows.length} />
        <Stat tono="aba" label="Propias / integradas" value={rows.filter(g => g.tipo === 'propia').length} />
        <Stat tono="peso" label="De terceros" value={rows.filter(g => g.tipo === 'tercero').length} />
        <Stat icon={AlertCircle} tono="desc" label="Por validar" value={rows.filter(g => g.por_validar).length} sub="Aparecen solo en el Excel de agosto" />
      </div>
      <div className="flex gap-1 bg-white rounded-xl p-1 mb-4 w-fit shadow-card">
        {[['', 'Todas'], ['propia', 'Propias'], ['tercero', 'Terceros'], ['validar', 'Por validar']].map(([v, t]) => <button key={v} onClick={() => setFiltro(v)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${filtro === v ? 'bg-jhs-500 text-white' : 'text-carbon-500'}`}>{t}</button>)}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lista.map(g => (
          <div key={g.id} className={`card p-5 ${!g.activo ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-extrabold text-lg">{g.nombre}</div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className={`chip ${g.tipo === 'propia' ? 'bg-aba-100 text-aba-700' : 'bg-cielo-100 text-cielo-700'}`}>{g.tipo === 'propia' ? 'Propia / integrada' : 'Tercero'}</span>
                  {g.por_validar && <span className="chip bg-desc-100 text-desc-700">Por validar</span>}
                  <span className="chip bg-carbon-100 text-carbon-500">{g.origen_dato}</span>
                </div>
              </div>
              {editable && <button className="btn-ghost !p-2" onClick={() => setEdit({ ...g, galpones: 0 })} aria-label="Editar"><Pencil size={16} /></button>}
            </div>
            <div className="text-sm text-carbon-500 mt-2 flex gap-1.5"><MapPin size={15} className="shrink-0 mt-0.5" />{g.ubicacion || 'Ubicación por completar'}</div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="rounded-xl bg-jhs-50 py-2"><div className="font-extrabold">{g.galpones}</div><div className="text-[10px] font-bold uppercase text-jhs-700">Galpones</div></div>
              <div className="rounded-xl bg-cielo-50 py-2"><div className="font-extrabold">{g.lotes_activos}</div><div className="text-[10px] font-bold uppercase text-cielo-700">Lotes activos</div></div>
              <div className="rounded-xl bg-amb-50 py-2"><div className="font-extrabold">{g.personal}</div><div className="text-[10px] font-bold uppercase text-amb-700">Personal</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3 items-center">
              {(g.lista_galpones || []).map(x => <span key={x.id} className="chip bg-carbon-100 text-carbon-600">G{x.numero}{x.capacidad ? ` · ${fmt(x.capacidad)}` : ''}</span>)}
              {editable && <button className="chip bg-jhs-100 text-jhs-700" onClick={() => agregarGalpon(g)}><Plus size={12} />Galpón</button>}
            </div>
            <div className="text-xs text-carbon-400 mt-3">Supervisor: {g.supervisor || '(pendiente)'}</div>
          </div>
        ))}
      </div>
      <Modal abierto={!!edit} onClose={() => setEdit(null)} titulo={edit?.id ? 'Editar granja' : 'Nueva granja'}>
        {edit && (
          <div className="space-y-3">
            <Campo label="Nombre"><input className="input" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo"><select className="input" value={edit.tipo} onChange={e => setEdit({ ...edit, tipo: e.target.value })}><option value="propia">Propia / integrada</option><option value="tercero">Tercero</option></select></Campo>
              <Campo label={edit.id ? 'Galpones (crear hasta el nº)' : 'Nº de galpones'}><input className="input" type="number" min="0" value={edit.galpones} onChange={e => setEdit({ ...edit, galpones: e.target.value })} /></Campo>
            </div>
            <Campo label="Ubicación"><input className="input" value={edit.ubicacion || ''} onChange={e => setEdit({ ...edit, ubicacion: e.target.value })} /></Campo>
            <Campo label="Supervisor"><input className="input" value={edit.supervisor || ''} onChange={e => setEdit({ ...edit, supervisor: e.target.value })} /></Campo>
            {edit.id && <div className="flex gap-4 text-sm font-semibold">
              <label className="flex items-center gap-2"><input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} />Activa</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={edit.por_validar} onChange={e => setEdit({ ...edit, por_validar: e.target.checked })} />Por validar</label>
            </div>}
            <button className="btn-primary w-full" onClick={guardar}>Guardar</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
