import { useState } from 'react';
import { RefreshCw, CloudUpload, AlertTriangle, Trash2, RotateCcw, CheckCircle2, Download } from 'lucide-react';
import { useApp } from '../../lib/store.jsx';
import { sincronizar, reintentar, descartar, fmtFecha } from '../../lib/api.js';
import { MODULOS } from '../../lib/modulos.js';
import { EstadoConexion, Vacio } from '../../components/ui.jsx';

export default function Sincronizar() {
  const { outbox, online, boot, aviso, recargar } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const lote = (id) => boot?.lotes.find(l => l.id === Number(id));

  const enviar = async () => {
    setOcupado(true);
    try { const r = await sincronizar(); await recargar(); aviso(r?.enviados ? `${r.enviados} registro(s) enviados` : 'Datos actualizados'); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">Sincronización</h1><EstadoConexion /></div>
      <div className="card p-5 space-y-3">
        <p className="text-carbon-600">Todo lo que registra se guarda primero en este teléfono y se envía automáticamente cuando hay señal. Puede trabajar varios días sin conexión.</p>
        <button className="btn-primary btn-big" onClick={enviar} disabled={!online || ocupado}>
          <RefreshCw size={20} className={ocupado ? 'animate-spin' : ''} />{online ? 'Sincronizar ahora' : 'Esperando señal…'}
        </button>
        {boot && <div className="text-xs text-carbon-400 flex items-center gap-1"><Download size={13} />Última descarga: {fmtFecha(boot.generado_en.slice(0, 10))} {new Date(boot.generado_en).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>}
      </div>
      <h2 className="label">Pendientes de envío ({outbox.length})</h2>
      {!outbox.length && <Vacio icon={CheckCircle2} titulo="Todo está al día" texto="No hay registros pendientes en este dispositivo." />}
      <div className="space-y-2">
        {outbox.map(i => {
          const p = i.payload; const m = MODULOS[i.kind === 'captura' ? p.tipo : i.kind === 'despacho' ? 'despacho' : 'pesaje'];
          const l = lote(p.lote_id);
          const I = i.kind === 'foto' ? CloudUpload : m.icon;
          return (
            <div key={i.id} className={`card p-3 flex gap-3 items-center ${i.estado === 'error' ? 'border-mort-500' : ''}`}>
              <span className={`grid place-items-center w-10 h-10 rounded-xl text-white shrink-0 ${i.kind === 'foto' ? 'bg-carbon-400' : m.bg}`}><I size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{i.kind === 'foto' ? 'Foto de evidencia' : m.titulo} {p.cantidad != null && `· ${p.cantidad}`}{p.peso_g && ` · ${p.peso_g} g`}{p.aves && ` · ${p.aves} aves`}</div>
                <div className="text-xs text-carbon-400 truncate">{l ? `${l.granja} G${l.galpon} · ` : ''}{p.fecha ? fmtFecha(p.fecha) : ''}</div>
                {i.error && <div className="text-xs font-bold text-mort-600 flex gap-1 mt-0.5"><AlertTriangle size={13} />{i.error}</div>}
              </div>
              {i.estado === 'error' ? (
                <div className="flex gap-1">
                  <button className="btn-ghost p-2" onClick={() => reintentar(i.id)} aria-label="Reintentar"><RotateCcw size={18} /></button>
                  <button className="btn-ghost p-2 text-mort-600" onClick={() => confirm('¿Descartar este registro? No se enviará.') && descartar(i.id)} aria-label="Descartar"><Trash2 size={18} /></button>
                </div>
              ) : <span className="chip bg-desc-100 text-desc-700">En cola</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
