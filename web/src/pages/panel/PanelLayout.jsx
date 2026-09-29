import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Layers, Warehouse, LineChart, Truck, Scale, Users, Settings, Smartphone, LogOut, Menu, X, QrCode } from 'lucide-react';
import { useApp, puede } from '../../lib/store.jsx';
import { Logo, EstadoConexion } from '../../components/ui.jsx';

const ITEMS = [
  { to: '/panel', end: true, t: 'Dashboard', I: LayoutDashboard, c: 'text-jhs-400' },
  { to: '/panel/lotes', t: 'Lotes', I: Layers, c: 'text-cielo-300' },
  { to: '/panel/granjas', t: 'Granjas y galpones', I: Warehouse, c: 'text-aba-500' },
  { to: '/panel/estandares', t: 'Estándar genético', I: LineChart, c: 'text-amb-500' },
  { to: '/panel/despachos', t: 'Despachos y planta', I: Truck, c: 'text-desp-500' },
  { to: '/panel/discrepancias', t: 'Conciliación', I: Scale, c: 'text-mort-500' },
  { to: '/panel/qr', t: 'Códigos QR', I: QrCode, c: 'text-jhs-300' },
  { to: '/panel/usuarios', t: 'Usuarios', I: Users, c: 'text-desc-500', roles: ['admin'] },
  { to: '/panel/configuracion', t: 'Configuración', I: Settings, c: 'text-carbon-300', roles: ['admin'] },
];

export default function PanelLayout() {
  const { user, logout } = useApp();
  const [abierto, setAbierto] = useState(false);
  const items = ITEMS.filter(i => !i.roles || puede(user, ...i.roles));
  const link = ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition ${isActive ? 'bg-white/10 text-white' : 'text-carbon-300 hover:bg-white/5 hover:text-white'}`;

  const Side = (
    <aside className="flex flex-col h-full w-64 bg-carbon-800 text-white">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <Logo className="h-10" />
        <div className="mt-3 font-extrabold">El Dorado · Granjas</div>
        <div className="text-xs text-carbon-300">Pollo de engorde · Grupo JHS</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-auto" onClick={() => setAbierto(false)}>
        {items.map(({ to, end, t, I, c }) => <NavLink key={to} to={to} end={end} className={link}><I size={19} className={c} />{t}</NavLink>)}
        <div className="pt-3 mt-3 border-t border-white/10">
          <Link to="/campo" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm bg-jhs-500 text-white hover:bg-jhs-600"><Smartphone size={19} />App de campo</Link>
        </div>
      </nav>
      <div className="p-4 border-t border-white/10 flex items-center gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-jhs-500 font-extrabold text-sm">{user.nombre.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
        <div className="min-w-0 flex-1"><div className="text-sm font-bold truncate">{user.nombre}</div><div className="text-xs text-carbon-300 truncate">{user.rol_nombre}</div></div>
        <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 text-carbon-300" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18} /></button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30 no-print">{Side}</div>
      {abierto && <div className="lg:hidden fixed inset-0 z-40 flex no-print"><div className="h-full">{Side}</div><div className="flex-1 bg-black/40" onClick={() => setAbierto(false)} /></div>}
      <header className="lg:hidden sticky top-0 z-20 bg-carbon-800 text-white flex items-center justify-between px-4 h-14 no-print">
        <button onClick={() => setAbierto(true)} className="p-2 -ml-2" aria-label="Menú">{abierto ? <X /> : <Menu />}</button>
        <Logo className="h-7" />
        <EstadoConexion compacto />
      </header>
      <main className="p-4 lg:p-8 max-w-[1400px] mx-auto"><Outlet /></main>
    </div>
  );
}

export function Encabezado({ migas, titulo, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {migas && <div className="text-xs font-bold uppercase tracking-wide text-carbon-400">{migas}</div>}
        <h1 className="text-2xl lg:text-3xl font-extrabold">{titulo}</h1>
      </div>
      <div className="flex flex-wrap gap-2 no-print">{children}</div>
    </div>
  );
}
