import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, KeyRound, LayoutDashboard, Smartphone } from 'lucide-react';
import { useApp, puede } from '../../lib/store.jsx';
import { api } from '../../lib/api.js';
import { Campo } from '../../components/ui.jsx';

export default function Perfil() {
  const { user, logout, aviso } = useApp();
  const [f, setF] = useState({ actual: '', nueva: '' });
  const cambiar = async (e) => {
    e.preventDefault();
    try { await api('/auth/password', { method: 'POST', body: f }); aviso('Contraseña actualizada'); setF({ actual: '', nueva: '' }); }
    catch (err) { aviso(err.message, 'error'); }
  };
  return (
    <div className="space-y-4">
      <div className="card p-5 flex items-center gap-4">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-jhs-500 text-white text-xl font-extrabold">{user.nombre.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
        <div><div className="font-extrabold text-lg">{user.nombre}</div><div className="text-carbon-500">{user.rol_nombre} · @{user.username}</div></div>
      </div>
      {puede(user, 'gerencia', 'coordinacion', 'productor', 'veterinario') && <Link to="/panel" className="btn-sec btn-big"><LayoutDashboard size={20} />Ir al portal de gestión</Link>}
      <div className="card p-5 flex gap-3 text-sm text-carbon-600"><Smartphone className="shrink-0 text-jhs-500" />Para instalar la app en el teléfono: abra el menú del navegador y elija «Agregar a pantalla de inicio» o «Instalar aplicación».</div>
      <form onSubmit={cambiar} className="card p-5 space-y-3">
        <div className="font-extrabold flex items-center gap-2"><KeyRound size={18} />Cambiar contraseña</div>
        <Campo label="Contraseña actual"><input type="password" className="input" value={f.actual} onChange={e => setF({ ...f, actual: e.target.value })} required /></Campo>
        <Campo label="Nueva contraseña"><input type="password" className="input" minLength={6} value={f.nueva} onChange={e => setF({ ...f, nueva: e.target.value })} required /></Campo>
        <button className="btn-sec w-full">Actualizar</button>
      </form>
      <button onClick={logout} className="btn btn-big bg-carbon-800 text-white"><LogOut size={20} />Cerrar sesión</button>
    </div>
  );
}
