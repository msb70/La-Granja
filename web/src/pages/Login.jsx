import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Egg, Wheat, Scale, CloudOff } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Logo } from '../components/ui.jsx';

export default function Login() {
  const { login, aviso } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try { await login(u, p); nav(loc.pathname.startsWith('/g/') ? loc.pathname : '/', { replace: true }); }
    catch (err) { aviso(err.message, 'error'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative overflow-hidden bg-gradient-to-br from-jhs-500 via-jhs-600 to-[#C2410C] text-white px-6 pt-10 pb-24 lg:p-14 flex flex-col">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/10" />
        <div className="absolute right-20 bottom-10 w-40 h-40 rounded-full bg-cielo-400/30" />
        <div className="absolute -left-10 bottom-[-60px] w-72 h-72 rounded-full bg-desc-500/30" />
        <Logo className="h-12 lg:h-16 relative" />
        <div className="relative mt-10 lg:mt-auto max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold mb-4">Agropecuaria El Dorado · Grupo JHS</div>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">Granjas de pollo de engorde, del galpón al dashboard.</h1>
          <p className="mt-4 text-white/85 text-lg hidden sm:block">Registre mortalidad, alimento y pesajes desde el campo, aunque no haya señal. Todo se sincroniza solo.</p>
          <div className="hidden sm:grid grid-cols-2 gap-3 mt-8">
            {[[Egg, 'Mortalidad y descartes'], [Wheat, 'Consumo de ABA por fase'], [Scale, 'Pesajes vs. estándar'], [CloudOff, 'Funciona sin conexión']].map(([I, t]) => (
              <div key={t} className="flex items-center gap-2.5 rounded-2xl bg-white/12 backdrop-blur px-3 py-2.5 font-semibold text-sm"><I size={18} />{t}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-start lg:items-center justify-center px-5 -mt-16 lg:mt-0 pb-10">
        <form onSubmit={entrar} className="card w-full max-w-sm p-7 relative">
          <h2 className="text-2xl font-extrabold">Iniciar sesión</h2>
          <p className="text-carbon-500 mb-6">El Dorado · Granjas</p>
          <label className="label" htmlFor="u">Usuario</label>
          <input id="u" className="input text-lg mb-4" autoComplete="username" autoCapitalize="none" value={u} onChange={e => setU(e.target.value)} required />
          <label className="label" htmlFor="p">Contraseña</label>
          <div className="relative mb-6">
            <input id="p" className="input text-lg pr-12" type={ver ? 'text' : 'password'} autoComplete="current-password" value={p} onChange={e => setP(e.target.value)} required />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-carbon-400" onClick={() => setVer(!ver)} aria-label="Mostrar contraseña">{ver ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
          <button className="btn-primary btn-big" disabled={enviando}><LogIn size={20} />{enviando ? 'Entrando…' : 'Entrar'}</button>
          <p className="text-xs text-carbon-400 mt-5 text-center">¿Olvidó su contraseña? Solicítela a Coordinación Central.</p>
        </form>
      </div>
    </div>
  );
}
