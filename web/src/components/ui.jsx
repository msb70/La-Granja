import { useEffect } from 'react';
import { X, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../lib/store.jsx';

export function Logo({ variante = 'blanco', className = 'h-8' }) {
  return <img src={variante === 'blanco' ? '/logo-jhs-blanco.svg' : '/logo-jhs-naranja.svg'} alt="JHS Agroindustria" className={className} />;
}

export const TONOS = {
  jhs: 'bg-jhs-50 text-jhs-700', mort: 'bg-mort-50 text-mort-700', desc: 'bg-desc-50 text-desc-700', aba: 'bg-aba-50 text-aba-700',
  peso: 'bg-peso-50 text-peso-700', amb: 'bg-amb-50 text-amb-700', desp: 'bg-desp-50 text-desp-700', carbon: 'bg-carbon-50 text-carbon-600',
};

export function Stat({ label, value, sub, tono = 'carbon', icon: Icon, grande }) {
  return (
    <div className="card p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2">
        {Icon && <span className={`grid place-items-center w-8 h-8 rounded-xl ${TONOS[tono]}`}><Icon size={17} /></span>}
        <span className="text-[11px] font-bold uppercase tracking-wide text-carbon-400 leading-tight line-clamp-2">{label}</span>
      </div>
      <div className={`${grande ? 'text-3xl' : 'text-2xl'} font-extrabold num text-carbon-800 truncate`}>{value}</div>
      {sub && <div className="text-xs text-carbon-500 truncate">{sub}</div>}
    </div>
  );
}

const SEM = {
  meta: ['En meta', 'bg-aba-100 text-aba-700'], vigilar: ['Vigilar', 'bg-desc-100 text-desc-700'], critico: ['Crítico', 'bg-mort-100 text-mort-700'],
};
export const Semaforo = ({ s }) => <span className={`chip ${SEM[s]?.[1] || 'bg-carbon-100 text-carbon-600'}`}>{SEM[s]?.[0] || s}</span>;

const EST = {
  activo: ['En curso', 'bg-cielo-100 text-cielo-700'], cerrado: ['Cerrado', 'bg-carbon-100 text-carbon-600'], discrepancia: ['Discrepancia', 'bg-mort-100 text-mort-700'],
  abierta: ['Abierta', 'bg-mort-100 text-mort-700'], justificada: ['Por aprobar', 'bg-desc-100 text-desc-700'], aprobada: ['Aprobada', 'bg-aba-100 text-aba-700'], rechazada: ['Rechazada', 'bg-mort-100 text-mort-700'],
};
export const Estado = ({ e }) => <span className={`chip ${EST[e]?.[1] || 'bg-carbon-100'}`}>{EST[e]?.[0] || e}</span>;

export function Modal({ abierto, onClose, titulo, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (!abierto) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [abierto, onClose]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-carbon-900/50 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-white w-full ${ancho} rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-auto`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur flex items-center justify-between px-5 py-4 border-b border-carbon-100">
          <h3 className="font-extrabold text-lg">{titulo}</h3>
          <button className="btn-ghost p-2" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  const err = toast.tipo === 'error';
  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 px-4 w-full max-w-md no-print">
      <div key={toast.id} className={`flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl text-white ${err ? 'bg-mort-600' : 'bg-carbon-800'}`}>
        {err ? <AlertTriangle className="shrink-0 mt-0.5" size={20} /> : <CheckCircle2 className="shrink-0 mt-0.5 text-aba-500" size={20} />}
        <span className="font-semibold">{toast.texto}</span>
      </div>
    </div>
  );
}

export function EstadoConexion({ compacto }) {
  const { online, outbox } = useApp();
  const pend = outbox.filter(i => i.estado !== 'error').length;
  const err = outbox.filter(i => i.estado === 'error').length;
  return (
    <span className={`chip ${online ? 'bg-aba-100 text-aba-700' : 'bg-carbon-700 text-white'} ${compacto ? '' : 'py-1 px-3'}`}>
      {online ? <Wifi size={13} /> : <WifiOff size={13} />}
      {online ? 'En línea' : 'Sin señal'}
      {pend > 0 && <span className="ml-1 inline-flex items-center gap-1"><RefreshCw size={12} className={online ? 'animate-spin' : ''} />{pend}</span>}
      {err > 0 && <span className="ml-1 text-mort-600">⚠ {err}</span>}
    </span>
  );
}

export const Spinner = ({ texto = 'Cargando…' }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-carbon-400">
    <div className="w-10 h-10 rounded-full border-4 border-jhs-100 border-t-jhs-500 animate-spin" />
    <span className="font-semibold text-sm">{texto}</span>
  </div>
);

export const Vacio = ({ icon: Icon, titulo, texto, children }) => (
  <div className="flex flex-col items-center text-center py-14 px-6 gap-2">
    {Icon && <span className="grid place-items-center w-14 h-14 rounded-2xl bg-jhs-50 text-jhs-500 mb-2"><Icon size={28} /></span>}
    <div className="font-extrabold text-lg">{titulo}</div>
    {texto && <p className="text-carbon-500 max-w-sm">{texto}</p>}
    {children}
  </div>
);

export function Campo({ label, children, ayuda }) {
  return <label className="block"><span className="label">{label}</span>{children}{ayuda && <span className="block text-xs text-carbon-400 mt-1">{ayuda}</span>}</label>;
}

export function Barra({ valor, max = 100, color = 'bg-jhs-500' }) {
  const p = Math.max(0, Math.min(100, (valor / max) * 100));
  return <div className="h-2 rounded-full bg-carbon-100 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: p + '%' }} /></div>;
}
