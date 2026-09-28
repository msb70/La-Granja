import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, CheckCircle2, XCircle, Paperclip } from 'lucide-react';
import { api, fmt, fmtFecha, uuid } from '../../lib/api.js';
import { useApp, puede } from '../../lib/store.jsx';
import { Spinner, Estado, Vacio, Modal } from '../../components/ui.jsx';
import Fotos from '../../components/Fotos.jsx';
import { Encabezado } from './PanelLayout.jsx';

export default function Discrepancias() {
  const { user, aviso } = useApp();
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [informe, setInforme] = useState('');
  const [fotos, setFotos] = useState([]);
  const [resol, setResol] = useState('');
  const cargar = () => api('/discrepancias').then(setRows).catch(() => setRows([]));
  useEffect(() => { cargar(); }, []);
  if (!rows) return <Spinner />;

  const abrir = (d) => { setSel(d); setInforme(d.informe || ''); setFotos([]); setResol(''); };
  const enviarInforme = async () => {
    try {
      if (fotos.length) await api('/sync', { method: 'POST', body: { fotos: fotos.map(data => ({ id: uuid(), lote_id: sel.lote_id, ref_tipo: 'discrepancia', ref_id: String(sel.id), data })) } });
      await api(`/discrepancias/${sel.id}/informe`, { method: 'POST', body: { informe } });
      aviso('Informe enviado a Gerencia'); setSel(null); cargar();
    } catch (e) { aviso(e.message, 'error'); cargar(); }
  };
  const resolver = async (aprobar) => {
    try { await api(`/discrepancias/${sel.id}/resolver`, { method: 'POST', body: { aprobar, resolucion: resol } }); aviso(aprobar ? 'Discrepancia aprobada: lote cerrado' : 'Informe rechazado'); setSel(null); cargar(); }
    catch (e) { aviso(e.message, 'error'); }
  };

  return (
    <div>
      <Encabezado migas="Conciliación e identificación de discrepancias" titulo="Workflow de tolerancia (2%)" />
      <div className="grid md:grid-cols-4 gap-3 mb-5">
        {[['1', 'Cierre de lote', 'El sistema compara inventario final vs. recepción', 'bg-cielo-400'], ['2', 'Cierre detenido', 'Si la diferencia supera la tolerancia', 'bg-mort-500'], ['3', 'Informe + evidencias', 'Coordinación Central explica la causa', 'bg-desc-500'], ['4', 'Aprobación gerencial', 'Gerencia aprueba (cierra) o rechaza', 'bg-aba-500']].map(([n, t, s, c]) => (
          <div key={n} className="card p-4 flex gap-3"><span className={`grid place-items-center w-9 h-9 rounded-xl text-white font-extrabold shrink-0 ${c}`}>{n}</span><div><div className="font-bold">{t}</div><div className="text-xs text-carbon-500">{s}</div></div></div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-carbon-50"><tr>{['Lote', 'Granja', 'Esperadas', 'Recibidas', 'Diferencia', '%', 'Evidencias', 'Estado', 'Detectada', ''].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rows.map(d => (
            <tr key={d.id} className="border-t border-carbon-100">
              <td className="td"><Link to={`/panel/lotes/${d.lote_id}`} className="font-bold text-jhs-600">{d.codigo}</Link></td>
              <td className="td">{d.granja} G{d.galpon}</td>
              <td className="td">{fmt(d.aves_esperadas)}</td><td className="td">{fmt(d.aves_recibidas)}</td>
              <td className="td font-bold text-mort-600">{fmt(d.diferencia)}</td><td className="td font-bold text-mort-600">{fmt(d.porcentaje, 2)}%</td>
              <td className="td">{d.evidencias ? <span className="chip bg-cielo-50 text-cielo-700"><Paperclip size={12} />{d.evidencias}</span> : '—'}</td>
              <td className="td"><Estado e={d.estado} /></td>
              <td className="td text-carbon-500">{fmtFecha(d.creado_en.slice(0, 10))}</td>
              <td className="td"><button className="btn-sec !py-1 !px-2 text-xs" onClick={() => abrir(d)}>Gestionar</button></td>
            </tr>))}
          </tbody>
        </table>
        {!rows.length && <Vacio icon={Scale} titulo="Sin discrepancias" texto="Todos los cierres han estado dentro de la tolerancia." />}
      </div>

      <Modal abierto={!!sel} onClose={() => setSel(null)} titulo={sel ? `Discrepancia · ${sel.codigo}` : ''}>
        {sel && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-carbon-50 p-2"><div className="text-xs font-bold text-carbon-400">Esperadas</div><div className="font-extrabold">{fmt(sel.aves_esperadas)}</div></div>
              <div className="rounded-xl bg-carbon-50 p-2"><div className="text-xs font-bold text-carbon-400">Recibidas</div><div className="font-extrabold">{fmt(sel.aves_recibidas)}</div></div>
              <div className="rounded-xl bg-mort-50 p-2"><div className="text-xs font-bold text-mort-600">Diferencia</div><div className="font-extrabold text-mort-600">{fmt(sel.porcentaje, 2)}%</div></div>
            </div>
            {sel.resolucion && <div className="rounded-xl bg-desc-50 p-3 text-sm"><b>Resolución de Gerencia:</b> {sel.resolucion}</div>}
            {['abierta', 'rechazada'].includes(sel.estado) && puede(user, 'coordinacion') && (
              <>
                <label className="block"><span className="label flex items-center gap-1"><FileText size={14} />Informe de Coordinación Central</span>
                  <textarea className="input" rows={5} value={informe} onChange={e => setInforme(e.target.value)} placeholder="Explique la causa de la diferencia: mortalidad en transporte, error de conteo, robo, aves no registradas…" /></label>
                <Fotos value={fotos} onChange={setFotos} obligatorio={!sel.evidencias} />
                <button className="btn-primary w-full" onClick={enviarInforme}>Enviar informe a Gerencia</button>
              </>
            )}
            {sel.estado !== 'abierta' && sel.informe && <div className="rounded-xl bg-carbon-50 p-3 text-sm"><b>Informe ({sel.informe_nombre}):</b> {sel.informe}</div>}
            {sel.estado === 'justificada' && puede(user, 'gerencia') && (
              <>
                <label className="block"><span className="label">Comentario de Gerencia</span><textarea className="input" rows={2} value={resol} onChange={e => setResol(e.target.value)} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn bg-mort-500 text-white" onClick={() => resolver(false)}><XCircle size={18} />Rechazar</button>
                  <button className="btn bg-aba-500 text-white" onClick={() => resolver(true)}><CheckCircle2 size={18} />Aprobar y cerrar</button>
                </div>
              </>
            )}
            {sel.estado === 'abierta' && !puede(user, 'coordinacion') && <div className="text-sm text-carbon-500">Pendiente de informe de Coordinación Central.</div>}
            {sel.estado === 'justificada' && !puede(user, 'gerencia') && <div className="text-sm text-carbon-500">Pendiente de aprobación de Gerencia.</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
