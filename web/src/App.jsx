import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './lib/store.jsx';
import { Spinner, Toast } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import CampoLayout from './pages/campo/CampoLayout.jsx';
import CampoInicio from './pages/campo/CampoInicio.jsx';
import LoteCampo from './pages/campo/LoteCampo.jsx';
import Captura from './pages/campo/Captura.jsx';
import AperturaLote from './pages/campo/AperturaLote.jsx';
import DespachoCampo from './pages/campo/DespachoCampo.jsx';
import Sincronizar from './pages/campo/Sincronizar.jsx';
import Perfil from './pages/campo/Perfil.jsx';
import IrGalpon from './pages/campo/IrGalpon.jsx';
import Escanear from './pages/campo/Escanear.jsx';
import CodigosQR from './pages/panel/CodigosQR.jsx';
import PanelLayout from './pages/panel/PanelLayout.jsx';
import Dashboard from './pages/panel/Dashboard.jsx';
import Lotes from './pages/panel/Lotes.jsx';
import LoteDetalle from './pages/panel/LoteDetalle.jsx';
import Granjas from './pages/panel/Granjas.jsx';
import Estandares from './pages/panel/Estandares.jsx';
import Despachos from './pages/panel/Despachos.jsx';
import Discrepancias from './pages/panel/Discrepancias.jsx';
import Usuarios from './pages/panel/Usuarios.jsx';
import Configuracion from './pages/panel/Configuracion.jsx';

const esCampo = (u) => ['galponero'].includes(u.rol) || (['productor', 'veterinario'].includes(u.rol) && window.innerWidth < 900);

export default function App() {
  const { user, cargando } = useApp();
  if (cargando) return <div className="min-h-screen grid place-items-center"><Spinner texto="Preparando El Dorado · Granjas…" /></div>;
  if (!user) return <><Routes><Route path="*" element={<Login />} /></Routes><Toast /></>;
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={esCampo(user) ? '/campo' : '/panel'} replace />} />
        <Route path="/g/:galponId" element={<CampoLayout />}><Route index element={<IrGalpon />} /></Route>
        <Route path="/campo" element={<CampoLayout />}>
          <Route index element={<CampoInicio />} />
          <Route path="lote/:id" element={<LoteCampo />} />
          <Route path="lote/:id/captura/:tipo" element={<Captura />} />
          <Route path="lote/:id/despacho" element={<DespachoCampo />} />
          <Route path="abrir/:galponId" element={<AperturaLote />} />
          <Route path="sync" element={<Sincronizar />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="escanear" element={<Escanear />} />
        </Route>
        <Route path="/panel" element={user.rol === 'galponero' ? <Navigate to="/campo" /> : <PanelLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="lotes" element={<Lotes />} />
          <Route path="lotes/:id" element={<LoteDetalle />} />
          <Route path="granjas" element={<Granjas />} />
          <Route path="estandares" element={<Estandares />} />
          <Route path="despachos" element={<Despachos />} />
          <Route path="discrepancias" element={<Discrepancias />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="qr" element={<CodigosQR />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
