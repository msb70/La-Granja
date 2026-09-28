import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Printer, Ban, Image as ImageIcon, Truck, Lock, History, AlertTriangle, CheckCircle2, Plus, Factory } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart } from 'recharts';
import { api, descargar, fmt, fmtFecha, fotoUrl, hoy, uuid } from '../../lib/api.js';
import { useApp, puede } from '../../lib/store.jsx';
import { MODULOS, CAUSAS_MORT } from '../../lib/modulos.js';
import { Stat, Semaforo, Estado, Spinner, Modal, Campo, Vacio } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';
import { RecepcionForm } from './Despachos.jsx';

const TABS = [['resumen', 'Resumen'], ['cuaderno', 'Cuaderno semanal'], ['diario', 'Diario'], ['capturas', 'Capturas y evidencias'], ['despachos', 'Despachos'], ['cierre', 'Cierre y conciliación'], ['historico', 'Histórico del galpón']];
const causa = (v) => CAUSAS_MORT.find(c => c.v === v)?.t || v;

export default function LoteDetalle() {
  const { id } = useParams();
  const { user, aviso, boot } = useApp();
  const [l, setL] = useState(null);
  const [tab, setTab] = useState('resumen');
  const [foto, setFoto] = useState(null);
  const [desp, setDesp] = useState(false);
  const [recep, setRecep] = useState(null);
  const cargar = useCallback(() => api(`/lotes/${id}`).then(setL).catch(e => aviso(e.message, 'error')), [id, aviso]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!l) return <Spinner />;
  const r = l.resumen;
  const activo = l.estado === 'activo';

  const anular = async (c) => {
    const motivo = prompt('Motivo de la anulación (queda en auditoría):');
    if (!motivo) return;
    try { await api(`/capturas/${c.id}/anular`, { method: 'POST', body: { motivo } }); aviso('Captura anulada'); cargar(); } catch (e) { aviso(e.message, 'error'); }
  };
  const cerrar = async () => {
    if (!confirm('Se comparará el inventario final del campo contra lo recibido en planta y venta en pie. ¿Cerrar el lote?')) return;
    try {
      const x = await api(`/lotes/${l.id}/cerrar`, { method: 'POST', body: { fecha: hoy() } });
      aviso(x.estado === 'cerrado' ? `Lote cerrado · diferencia ${x.porcentaje}%` : `Cierre detenido: diferencia ${x.porcentaje}% supera la tolerancia de ${x.tolerancia}%`, x.estado === 'cerrado' ? 'ok' : 'error');
      cargar();
    } catch (e) { aviso(e.message, 'error'); }
  };

  const dias = l.dias.filter(d => d.dia <= Math.max(r.dia_ultima_captura, r.dia_peso || 0, 7));

  return (
    <div>
      <Encabezado migas={<Link to="/panel/lotes" className="hover:text-jhs-600">Lotes</Link>} titulo={<span>{l.granja} · Galpón {l.galpon} <span className="text-jhs-500">{l.codigo}</span></span>}>
        <button className="btn-sec" onClick={() => descargar(`/reportes/lote/${l.id}/excel`)}><Download size={17} />Excel</button>
        <button className="btn-sec" onClick={() => window.print()}><Printer size={17} />Imprimir / PDF</button>
      </Encabezado>

      <div className="flex flex-wrap gap-2 items-center mb-4 text-sm">
        {activo ? <Semaforo s={r.semaforo} /> : <Estado e={l.estado} />}
        <span className="chip bg-carbon-100 text-carbon-600">{l.raza}</span>
        <span className="chip bg-carbon-100 text-carbon-600">Incubadora {l.incubadora || '—'}</span>
        <span className="chip bg-carbon-100 text-carbon-600">Entrada {fmtFecha(l.fecha_entrada, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span className="chip bg-jhs-100 text-jhs-700">Día {r.dia_actual}</span>
        {l.demo && <span className="chip bg-desc-100 text-desc-700">Datos de demostración</span>}
        {l.observaciones && <span className="text-carbon-500">· {l.observaciones}</span>}
      </div>

      {r.alertas.length > 0 && <div className="rounded-2xl bg-mort-50 border border-mort-100 p-3 mb-4 flex flex-wrap gap-x-5 gap-y-1">{r.alertas.map((a, i) => <span key={i} className="flex gap-1.5 text-sm font-semibold text-mort-700"><AlertTriangle size={16} />{a.texto}</span>)}</div>}

      <div className="flex gap-1 overflow-x-auto mb-4 no-print border-b border-carbon-100">
        {TABS.map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-2.5 font-bold text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-jhs-500 text-jhs-600' : 'border-transparent text-carbon-400 hover:text-carbon-700'}`}>{t}</button>)}
      </div>

      {tab === 'resumen' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Stat tono="peso" label="Aves alojadas" value={fmt(l.aves_alojadas)} />
            <Stat tono="jhs" label={activo ? 'Saldo de aves' : 'Aves despachadas'} value={fmt(activo ? r.saldo : r.aves_despachadas)} sub={`Viabilidad ${fmt(r.viabilidad, 1)}%`} />
            <Stat tono="mort" label="Mortalidad" value={`${fmt(r.pct_mort, 2)}%`} sub={`${fmt(r.mort_acum)} aves · ${fmt(r.desc_acum)} descartes`} />
            <Stat tono="aba" label="ABA acumulado" value={`${fmt(r.aba_acum_kg)} kg`} sub={`${fmt(r.consumo_ave_g)} g/ave · ${fmt(r.gr_ave_dia, 1)} g/ave/día`} />
            <Stat tono="peso" label={`Peso día ${r.dia_peso ?? '—'}`} value={`${fmt(r.peso_g)} g`} sub={<span className={r.dif_peso_pct < -5 ? 'text-mort-600 font-bold' : ''}>Estándar {fmt(r.peso_std_g)} g ({fmt(r.dif_peso_pct, 1)}%)</span>} />
            <Stat tono="amb" label="G.D.P." value={`${fmt(r.gdp, 1)} g/día`} sub={`Estándar ${fmt(r.gdp_std, 1)}`} />
            <Stat tono="aba" label="Conversión (FCR)" value={fmt(r.fcr, 3)} sub={`Estándar ${fmt(r.fcr_std, 2)} · desv. ${fmt(r.desv_fcr, 3)}`} />
            <Stat tono="desp" label="I.E.E." value={fmt(r.iee)} sub={r.iee ? `Edad ${fmt(r.edad, 1)} d · peso ${fmt(r.peso_prom_kg, 3)} kg` : 'Se calcula desde el día 28'} />
            <Stat tono="jhs" label="% Cumplimiento" value={`${fmt(r.cumplimiento, 1)}%`} />
            <Stat tono="carbon" label="Última captura" value={fmtFecha(r.ultima_captura)} sub={`Día ${r.dia_ultima_captura}`} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="font-extrabold mb-2">Curva de crecimiento</div>
              <div className="h-72"><ResponsiveContainer>
                <LineChart data={dias.map(d => ({ dia: d.dia, estandar: d.peso_std_g, real: d.peso_g }))} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#EEF1F2" /><XAxis dataKey="dia" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => `${fmt(v)} g`} labelFormatter={v => `Día ${v}`} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="estandar" name="Estándar" stroke="#27AAE1" strokeWidth={3} dot={false} />
                  <Line dataKey="real" name="Real" stroke="#F37021" strokeWidth={3} connectNulls dot={{ r: 4 }} />
                </LineChart></ResponsiveContainer></div>
            </div>
            <div className="card p-5">
              <div className="font-extrabold mb-2">Mortalidad diaria y % acumulado</div>
              <div className="h-72"><ResponsiveContainer>
                <ComposedChart data={dias.filter(d => d.dia > 0)} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#EEF1F2" /><XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="a" tick={{ fontSize: 11 }} /><YAxis yAxisId="b" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
                  <Tooltip labelFormatter={v => `Día ${v}`} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="a" isAnimationActive={false} dataKey="mortalidad" name="Aves muertas" fill="#E5484D" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="b" isAnimationActive={false} dataKey="pct_mort_acum" name="% acumulado" stroke="#37474F" strokeWidth={2} dot={false} />
                </ComposedChart></ResponsiveContainer></div>
            </div>
            <div className="card p-5">
              <div className="font-extrabold mb-2">Consumo de alimento (g/ave/día)</div>
              <div className="h-64"><ResponsiveContainer>
                <BarChart data={dias.filter(d => d.dia > 0)} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#EEF1F2" /><XAxis dataKey="dia" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => `${fmt(v, 1)} g`} labelFormatter={v => `Día ${v}`} />
                  <Bar dataKey="gr_ave_dia" name="g/ave/día" fill="#3FA34D" radius={[4, 4, 0, 0]} />
                </BarChart></ResponsiveContainer></div>
            </div>
            <div className="card p-5">
              <div className="font-extrabold mb-2">Conversión real vs. estándar (días de pesaje)</div>
              <div className="h-64"><ResponsiveContainer>
                <LineChart data={dias.filter(d => d.fcr != null)} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#EEF1F2" /><XAxis dataKey="dia" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={v => fmt(v, 3)} labelFormatter={v => `Día ${v}`} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="fcr_std" name="Estándar" stroke="#27AAE1" strokeWidth={3} connectNulls />
                  <Line dataKey="fcr" name="Real" stroke="#8E6CEF" strokeWidth={3} connectNulls />
                </LineChart></ResponsiveContainer></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'cuaderno' && (
        <div className="space-y-4">
          <div className="card overflow-x-auto">
            <div className="px-5 pt-4 font-extrabold text-mort-600">Mortalidad</div>
            <table className="w-full text-sm mt-2">
              <thead className="bg-mort-50"><tr><th className="th">Semana</th>{[1, 2, 3, 4, 5, 6, 7].map(i => <th key={i} className="th text-right">D{i}</th>)}<th className="th text-right">Total sem</th><th className="th text-right">Desc. sem</th><th className="th text-right">Acum.</th><th className="th text-right">% Sem</th><th className="th text-right">% Acum</th><th className="th text-right">Saldo aves</th></tr></thead>
              <tbody>{l.semanas.map(s => <tr key={s.semana} className="border-t border-carbon-100"><td className="td font-bold">{s.semana}</td>{[0, 1, 2, 3, 4, 5, 6].map(i => <td key={i} className="td text-right">{s.dias[i]?.mort ?? ''}</td>)}<td className="td text-right font-bold">{s.mort_sem}</td><td className="td text-right">{s.desc_sem || '—'}</td><td className="td text-right">{s.mort_acum}</td><td className="td text-right">{fmt(s.pct_sem, 2)}</td><td className="td text-right">{fmt(s.pct_acum, 2)}</td><td className="td text-right font-bold">{fmt(s.saldo)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="card overflow-x-auto">
            <div className="px-5 pt-4 font-extrabold text-aba-600">Consumo ABA (kg)</div>
            <table className="w-full text-sm mt-2">
              <thead className="bg-aba-50"><tr><th className="th">Semana</th>{[1, 2, 3, 4, 5, 6, 7].map(i => <th key={i} className="th text-right">D{i}</th>)}<th className="th text-right">Total sem</th><th className="th text-right">Acum.</th><th className="th text-right">g/ave/sem</th><th className="th text-right">g/ave/día</th><th className="th text-right">Peso g</th><th className="th text-right">Kg producidos</th><th className="th text-right">Conversión</th></tr></thead>
              <tbody>{l.semanas.map(s => <tr key={s.semana} className="border-t border-carbon-100"><td className="td font-bold">{s.semana}</td>{[0, 1, 2, 3, 4, 5, 6].map(i => <td key={i} className="td text-right">{s.dias[i]?.aba ?? ''}</td>)}<td className="td text-right font-bold">{fmt(s.aba_sem)}</td><td className="td text-right">{fmt(s.aba_acum)}</td><td className="td text-right">{fmt(s.gr_ave_sem, 1)}</td><td className="td text-right">{fmt(s.gr_ave_dia, 1)}</td><td className="td text-right">{fmt(s.peso_g)}</td><td className="td text-right">{fmt(s.kg_producidos, 1)}</td><td className="td text-right font-bold">{fmt(s.fcr, 3)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="card overflow-x-auto">
            <div className="px-5 pt-4 font-extrabold text-peso-600">Pesos vs. estándar ({l.raza})</div>
            <table className="w-full text-sm mt-2">
              <thead className="bg-peso-50"><tr><th className="th">Día</th>{dias.filter(d => d.peso_g != null).map(d => <th key={d.dia} className="th text-right">{d.dia}</th>)}</tr></thead>
              <tbody>
                <tr className="border-t border-carbon-100"><td className="td font-bold">Estándar g</td>{dias.filter(d => d.peso_g != null).map(d => <td key={d.dia} className="td text-right">{fmt(d.peso_std_g)}</td>)}</tr>
                <tr className="border-t border-carbon-100"><td className="td font-bold">Real g</td>{dias.filter(d => d.peso_g != null).map(d => <td key={d.dia} className="td text-right font-bold">{fmt(d.peso_g)}</td>)}</tr>
                <tr className="border-t border-carbon-100"><td className="td font-bold">% Dif.</td>{dias.filter(d => d.peso_g != null).map(d => <td key={d.dia} className={`td text-right font-semibold ${d.dif_peso_pct < -5 ? 'text-mort-600' : 'text-aba-600'}`}>{fmt(d.dif_peso_pct, 1)}%</td>)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'diario' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-carbon-50 sticky top-0"><tr>{['Día', 'Fecha', 'Mort.', 'Desc.', 'Salidas', 'Saldo', '% Mort ac.', 'ABA kg', 'ABA acum', 'g/ave/día', 'Peso', 'Estándar', '% Dif', 'FCR', 'IEE', 'Temp °C'].map(h => <th key={h} className="th text-right first:text-left">{h}</th>)}</tr></thead>
            <tbody>{[...dias].reverse().map(d => (
              <tr key={d.dia} className="border-t border-carbon-100">
                <td className="td font-bold">{d.dia}</td><td className="td text-right">{fmtFecha(d.fecha)}</td>
                <td className="td text-right text-mort-600 font-semibold">{d.mortalidad || ''}</td><td className="td text-right">{d.descarte || ''}</td><td className="td text-right">{d.salidas || ''}</td>
                <td className="td text-right">{fmt(d.saldo)}</td><td className="td text-right">{fmt(d.pct_mort_acum, 2)}</td><td className="td text-right">{d.aba_kg ? fmt(d.aba_kg) : ''}</td><td className="td text-right">{fmt(d.aba_acum_kg)}</td>
                <td className="td text-right">{fmt(d.gr_ave_dia, 1)}</td><td className="td text-right font-bold">{d.peso_g ? fmt(d.peso_g) : ''}</td><td className="td text-right text-carbon-400">{fmt(d.peso_std_g)}</td>
                <td className="td text-right">{d.dif_peso_pct != null ? fmt(d.dif_peso_pct, 1) + '%' : ''}</td><td className="td text-right">{d.fcr ? fmt(d.fcr, 3) : ''}</td><td className="td text-right">{d.iee ? fmt(d.iee) : ''}</td><td className="td text-right">{d.temp != null ? fmt(d.temp, 1) : ''}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'capturas' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-carbon-50"><tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Detalle</th><th className="th">Observaciones</th><th className="th">Evidencias</th><th className="th">Registró</th><th className="th">Sincronizado</th><th className="th"></th></tr></thead>
            <tbody>{l.capturas.map(c => {
              const m = MODULOS[c.tipo]; const fotos = l.fotos.filter(f => f.captura_id === c.id);
              return (
                <tr key={c.id} className={`border-t border-carbon-100 ${c.anulado ? 'opacity-40 line-through' : ''}`}>
                  <td className="td">{fmtFecha(c.fecha)}</td>
                  <td className="td"><span className={`chip ${m.soft} ${m.text}`}>{m.titulo}</span></td>
                  <td className="td font-semibold">
                    {['mortalidad', 'descarte'].includes(c.tipo) && `${fmt(c.cantidad)} aves · ${causa(c.causa)}`}
                    {c.tipo === 'aba' && `${fmt(c.cantidad)} kg · ${c.fase}`}
                    {c.tipo === 'pesaje' && `${fmt(c.peso_g)} g · muestra ${c.muestra || '—'}`}
                    {c.tipo === 'ambiente' && `${c.temperatura ?? '—'} °C · ${c.humedad ?? '—'}%`}
                  </td>
                  <td className="td text-carbon-500 max-w-[220px] truncate">{c.observaciones}</td>
                  <td className="td">{fotos.map((f, i) => <button key={f.id} onClick={() => setFoto(f.id)} className="chip bg-cielo-50 text-cielo-700 mr-1"><ImageIcon size={12} />#{i + 1}</button>)}</td>
                  <td className="td text-carbon-500">{c.usuario}</td>
                  <td className="td text-carbon-400 text-xs">{new Date(c.sincronizado_en).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="td">{!c.anulado && activo && puede(user, 'coordinacion', 'veterinario', 'productor') && <button className="btn-ghost !p-1.5 text-mort-600" onClick={() => anular(c)} title="Anular"><Ban size={16} /></button>}</td>
                </tr>);
            })}</tbody>
          </table>
          {!l.capturas.length && <Vacio titulo="Sin capturas" />}
        </div>
      )}

      {tab === 'despachos' && (
        <div className="space-y-3">
          {activo && puede(user, 'coordinacion', 'productor', 'galponero') && <button className="btn-primary" onClick={() => setDesp(true)}><Plus size={18} />Registrar salida de aves</button>}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-desp-50"><tr>{['Fecha', 'Destino', 'Aves', 'Kg en pie', 'Peso prom', 'Recibidas', 'Kg recibidos', 'Merma kg', 'Tipo A kg', 'Tipo B kg', 'Rend. canal', ''].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>{l.despachos.map(d => {
                const benef = (Number(d.kg_tipo_a) || 0) + (Number(d.kg_tipo_b) || 0);
                return (
                  <tr key={d.id} className="border-t border-carbon-100">
                    <td className="td">{fmtFecha(d.fecha)}</td>
                    <td className="td font-semibold">{d.destino === 'planta' ? <span className="flex items-center gap-1"><Factory size={14} />{d.planta}</span> : `Venta en pie · ${d.cliente}`}</td>
                    <td className="td">{fmt(d.aves)}</td><td className="td">{fmt(d.kg_pie, 1)}</td><td className="td">{fmt(d.kg_pie / d.aves, 3)}</td>
                    <td className="td font-bold">{d.destino === 'planta' ? fmt(d.aves_recibidas) : '—'}</td>
                    <td className="td">{fmt(d.kg_recibidos, 1)}</td><td className="td">{d.kg_recibidos != null ? fmt(d.kg_pie - d.kg_recibidos, 1) : '—'}</td>
                    <td className="td">{fmt(d.kg_tipo_a)}</td><td className="td">{fmt(d.kg_tipo_b)}</td>
                    <td className={`td font-bold ${benef && benef / d.kg_pie * 100 < 92 ? 'text-desc-600' : 'text-aba-600'}`}>{benef ? fmt(benef / d.kg_pie * 100, 1) + '%' : '—'}</td>
                    <td className="td">{d.destino === 'planta' && puede(user, 'coordinacion') && <button className="btn-sec !py-1 !px-2 text-xs" onClick={() => setRecep(d)}>{d.aves_recibidas == null ? 'Registrar recepción' : 'Editar recepción'}</button>}</td>
                  </tr>);
              })}</tbody>
            </table>
            {!l.despachos.length && <Vacio icon={Truck} titulo="Sin despachos" texto="Las salidas de aves se registran desde la app de campo o aquí." />}
          </div>
        </div>
      )}

      {tab === 'cierre' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <div className="font-extrabold flex items-center gap-2"><Lock size={18} />Cierre del lote</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-carbon-50 p-3"><div className="text-xs font-bold text-carbon-400">Inventario final (campo)</div><div className="text-xl font-extrabold num">{fmt(r.vivos_campo)}</div><div className="text-xs text-carbon-400">Alojadas − mortalidad − descartes</div></div>
              <div className="rounded-xl bg-carbon-50 p-3"><div className="text-xs font-bold text-carbon-400">Recibidas (planta + venta)</div><div className="text-xl font-extrabold num">{fmt(l.despachos.reduce((s, d) => s + (d.destino === 'planta' ? Number(d.aves_recibidas || 0) : d.aves), 0))}</div><div className="text-xs text-carbon-400">Tolerancia máxima {boot?.config?.tolerancia_conciliacion ?? 2}%</div></div>
            </div>
            {activo ? (
              puede(user, 'coordinacion', 'productor')
                ? <button className="btn btn-big bg-carbon-800 text-white" onClick={cerrar}><Lock size={18} />Ejecutar conciliación y cerrar</button>
                : <div className="text-sm text-carbon-500">El cierre lo realiza Coordinación Central o el productor.</div>
            ) : <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="text-aba-600" />Estado: <Estado e={l.estado} /> {l.fecha_cierre && `· ${fmtFecha(l.fecha_cierre)}`}</div>}
            <p className="text-xs text-carbon-400">Requisitos: todos los despachos a planta deben tener su recepción registrada. Si la diferencia supera la tolerancia, el cierre se detiene y se abre un proceso de discrepancia que exige informe de Coordinación, evidencias y aprobación de Gerencia.</p>
          </div>
          <div className="card p-5">
            <div className="font-extrabold mb-3">Discrepancias</div>
            {!l.discrepancias.length ? <div className="text-sm text-carbon-400">Sin discrepancias registradas.</div> : l.discrepancias.map(x => (
              <div key={x.id} className="rounded-xl border border-carbon-100 p-3 mb-2 text-sm">
                <div className="flex justify-between"><Estado e={x.estado} /><b className="text-mort-600">{fmt(x.porcentaje, 2)}% · {fmt(x.diferencia)} aves</b></div>
                {x.informe && <p className="mt-2"><b>Informe:</b> {x.informe}</p>}
                {x.resolucion && <p className="mt-1"><b>Resolución:</b> {x.resolucion}</p>}
                <Link to="/panel/discrepancias" className="text-jhs-600 font-bold text-xs mt-2 inline-block">Gestionar →</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'historico' && (
        <div className="card overflow-x-auto">
          <div className="p-5 pb-2 font-extrabold flex items-center gap-2"><History size={18} />Lotes anteriores en {l.granja} · Galpón {l.galpon}</div>
          <table className="w-full text-sm">
            <thead className="bg-carbon-50"><tr>{['Lote', 'Entrada', 'Raza', 'Alojadas', 'Mort. %', 'Peso kg', 'Edad', 'FCR', 'IEE', 'Estado'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              <tr className="bg-jhs-50 font-bold"><td className="td">{l.codigo} (actual)</td><td className="td">{fmtFecha(l.fecha_entrada)}</td><td className="td">{l.raza}</td><td className="td">{fmt(l.aves_alojadas)}</td><td className="td">{fmt(r.pct_mort, 2)}</td><td className="td">{fmt(r.peso_prom_kg, 3)}</td><td className="td">{fmt(r.edad, 1)}</td><td className="td">{fmt(r.fcr, 3)}</td><td className="td">{fmt(r.iee)}</td><td className="td"><Estado e={l.estado} /></td></tr>
              {l.historico.map(h => <tr key={h.id} className="border-t border-carbon-100"><td className="td"><Link className="text-jhs-600 font-bold" to={`/panel/lotes/${h.id}`}>{h.codigo}</Link></td><td className="td">{fmtFecha(h.fecha_entrada)}</td><td className="td">{h.raza}</td><td className="td">{fmt(h.aves_alojadas)}</td><td className="td">{fmt(h.resumen.pct_mort, 2)}</td><td className="td">{fmt(h.resumen.peso_prom_kg, 3)}</td><td className="td">{fmt(h.resumen.edad, 1)}</td><td className="td">{fmt(h.resumen.fcr, 3)}</td><td className="td">{fmt(h.resumen.iee)}</td><td className="td"><Estado e={h.estado} /></td></tr>)}
            </tbody>
          </table>
          {!l.historico.length && <div className="p-5 text-sm text-carbon-400">Este es el primer lote registrado en el sistema para este galpón. El histórico se construye a medida que se cierran lotes.</div>}
        </div>
      )}

      <Modal abierto={!!foto} onClose={() => setFoto(null)} titulo="Evidencia fotográfica" ancho="max-w-3xl">{foto && <img src={fotoUrl(foto)} alt="Evidencia" className="w-full rounded-xl" />}</Modal>
      <Modal abierto={desp} onClose={() => setDesp(false)} titulo="Salida de aves"><DespachoForm lote={l} plantas={boot?.plantas || []} onOk={() => { setDesp(false); cargar(); }} /></Modal>
      <Modal abierto={!!recep} onClose={() => setRecep(null)} titulo="Recepción en planta beneficiadora">{recep && <RecepcionForm d={recep} onOk={() => { setRecep(null); cargar(); }} />}</Modal>
    </div>
  );
}

function DespachoForm({ lote, plantas, onOk }) {
  const { aviso } = useApp();
  const [f, setF] = useState({ fecha: hoy(), destino: 'planta', planta_id: plantas[0]?.id, cliente: '', aves: '', kg_pie: '', placa: '', flete: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = async () => {
    try { await api('/despachos', { method: 'POST', body: { ...f, id: uuid(), lote_id: lote.id, aves: Number(f.aves), kg_pie: Number(f.kg_pie), planta_id: Number(f.planta_id) } }); aviso('Despacho registrado'); onOk(); }
    catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Destino"><select className="input" value={f.destino} onChange={set('destino')}><option value="planta">Planta beneficiadora</option><option value="venta_pie">Venta en pie</option></select></Campo>
        {f.destino === 'planta' ? <Campo label="Planta"><select className="input" value={f.planta_id} onChange={set('planta_id')}>{plantas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
          : <Campo label="Cliente"><input className="input" value={f.cliente} onChange={set('cliente')} /></Campo>}
        <Campo label="Fecha"><input type="date" className="input" value={f.fecha} onChange={set('fecha')} /></Campo>
        <Campo label={`Aves (saldo ${fmt(lote.resumen.saldo)})`}><input className="input" inputMode="numeric" value={f.aves} onChange={set('aves')} /></Campo>
        <Campo label="Kg netos en pie"><input className="input" inputMode="decimal" value={f.kg_pie} onChange={set('kg_pie')} /></Campo>
        <Campo label="Placa"><input className="input" value={f.placa} onChange={set('placa')} /></Campo>
      </div>
      <button className="btn-primary w-full" onClick={ok}>Registrar</button>
    </div>
  );
}
