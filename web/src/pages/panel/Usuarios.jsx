import { useEffect, useState } from 'react';
import { Plus, Pencil, Shield } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { Spinner, Modal, Campo } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

const COLOR_ROL = { admin: 'bg-carbon-800 text-white', gerencia: 'bg-jhs-100 text-jhs-700', coordinacion: 'bg-cielo-100 text-cielo-700', veterinario: 'bg-amb-100 text-amb-700', productor: 'bg-aba-100 text-aba-700', galponero: 'bg-desc-100 text-desc-700' };

export default function Usuarios() {
  const { aviso } = useApp();
  const [rows, setRows] = useState(null);
  const [roles, setRoles] = useState({});
  const [granjas, setGranjas] = useState([]);
  const [edit, setEdit] = useState(null);
  const cargar = () => api('/usuarios').then(setRows).catch(e => { aviso(e.message, 'error'); setRows([]); });
  useEffect(() => { cargar(); api('/roles').then(setRoles); api('/granjas').then(setGranjas); }, []);
  if (!rows) return <Spinner />;
  const nombreGranja = (id) => granjas.find(g => g.id === id)?.nombre;
  const guardar = async () => {
    try { await api('/usuarios', { method: 'POST', body: edit }); aviso('Usuario guardado'); setEdit(null); cargar(); } catch (e) { aviso(e.message, 'error'); }
  };
  const global = (rol) => ['admin', 'gerencia', 'coordinacion'].includes(rol);
  return (
    <div>
      <Encabezado migas="Seguridad · Control de acceso por roles" titulo="Usuarios">
        <button className="btn-primary" onClick={() => setEdit({ username: '', nombre: '', rol: 'galponero', password: '', granjas: [], activo: true })}><Plus size={18} />Nuevo usuario</button>
      </Encabezado>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-carbon-50"><tr>{['Nombre', 'Usuario', 'Rol', 'Granjas asignadas', 'Estado', ''].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map(u => (
            <tr key={u.id} className={`border-t border-carbon-100 ${!u.activo ? 'opacity-50' : ''}`}>
              <td className="td font-bold">{u.nombre}</td><td className="td text-carbon-500">@{u.username}</td>
              <td className="td"><span className={`chip ${COLOR_ROL[u.rol]}`}>{roles[u.rol] || u.rol}</span></td>
              <td className="td whitespace-normal">{global(u.rol) ? <span className="chip bg-carbon-100 text-carbon-600"><Shield size={12} />Todas</span> : u.granjas.map(g => <span key={g} className="chip bg-jhs-50 text-jhs-700 mr-1 mb-1">{nombreGranja(g)}</span>)}</td>
              <td className="td">{u.activo ? 'Activo' : 'Inactivo'}</td>
              <td className="td"><button className="btn-ghost !p-1.5" onClick={() => setEdit({ ...u, password: '' })}><Pencil size={16} /></button></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <Modal abierto={!!edit} onClose={() => setEdit(null)} titulo={edit?.id ? 'Editar usuario' : 'Nuevo usuario'}>
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre completo"><input className="input" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
              <Campo label="Usuario"><input className="input" autoCapitalize="none" value={edit.username} onChange={e => setEdit({ ...edit, username: e.target.value.trim() })} /></Campo>
              <Campo label="Rol"><select className="input" value={edit.rol} onChange={e => setEdit({ ...edit, rol: e.target.value })}>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
              <Campo label={edit.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}><input className="input" type="text" value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} /></Campo>
            </div>
            {!global(edit.rol) && (
              <div>
                <span className="label">Granjas a las que tiene acceso</span>
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-auto rounded-xl border border-carbon-100 p-2">
                  {granjas.map(g => (
                    <label key={g.id} className="flex items-center gap-2 text-sm font-semibold p-1.5 rounded-lg hover:bg-carbon-50">
                      <input type="checkbox" checked={edit.granjas.includes(g.id)} onChange={e => setEdit({ ...edit, granjas: e.target.checked ? [...edit.granjas, g.id] : edit.granjas.filter(x => x !== g.id) })} />{g.nombre}
                    </label>))}
                </div>
              </div>
            )}
            {edit.id && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} />Usuario activo</label>}
            <button className="btn-primary w-full" onClick={guardar}>Guardar</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
