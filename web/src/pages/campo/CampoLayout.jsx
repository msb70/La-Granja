import { NavLink, Outlet, Link } from 'react-router-dom';
import { Home, RefreshCw, User, LayoutDashboard } from 'lucide-react';
import { useApp, puede } from '../../lib/store.jsx';
import { Logo, EstadoConexion } from '../../components/ui.jsx';

export default function CampoLayout() {
  const { user, outbox } = useApp();
  const pend = outbox.length;
  const tab = ({ isActive }) => `flex flex-col items-center gap-0.5 py-2 px-3 rounded-2xl text-[11px] font-bold transition ${isActive ? 'text-jhs-600 bg-jhs-50' : 'text-carbon-400'}`;
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-jhs-500 text-white shadow-lg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/campo" className="flex items-center gap-2.5">
            <Logo className="h-7" />
            <span className="font-extrabold leading-tight text-sm border-l border-white/30 pl-2.5">El Dorado<br /><span className="font-semibold text-white/80 text-xs">Granjas</span></span>
          </Link>
          <EstadoConexion />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-4"><Outlet /></main>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-carbon-100 no-print" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-2xl mx-auto flex justify-around py-1.5">
          <NavLink to="/campo" end className={tab}><Home size={22} />Inicio</NavLink>
          <NavLink to="/campo/sync" className={tab}>
            <span className="relative"><RefreshCw size={22} />{pend > 0 && <span className="absolute -top-1.5 -right-2.5 bg-mort-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] grid place-items-center px-1">{pend}</span>}</span>
            Sincronizar
          </NavLink>
          {puede(user, 'gerencia', 'coordinacion', 'veterinario', 'productor') && <NavLink to="/panel" className={tab}><LayoutDashboard size={22} />Panel</NavLink>}
          <NavLink to="/campo/perfil" className={tab}><User size={22} />Perfil</NavLink>
        </div>
      </nav>
    </div>
  );
}
