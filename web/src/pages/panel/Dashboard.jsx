import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bird, Skull, Repeat, Target, Clock, Scale, AlertTriangle, Download, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, LineChart, Line, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import { api, descargar, fmt } from '../../lib/api.js';
import { Stat, Semaforo, Spinner, Estado } from '../../components/ui.jsx';
import { Encabezado } from './PanelLayout.jsx';

const colorCumpl = (c) => (c == null ? '#C7D0D4' : c >= 95 ? '#3FA34D' : c >= 90 ? '#F5A524' : '#E5484D');
const METRICAS = { fcr: ['Conversión (FCR)', 3], mortalidad: ['Mortalidad %', 2], iee: ['I.E.E.', 0], cumplimiento: ['% Cumplimiento', 1] };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [loteSel, setLoteSel] = useState(null);
  const [curva, setCurva] = useState(null);
  const [metrica, setMetrica] = useState('fcr');

  useEffect(() => { api('/dashboard').then(x => { setD(x); setLoteSel([...x.lotes].filter(l => l.estado === 'activo' && l.resumen.peso_g).sort((a, b) => (b.resumen.dia_peso || 0) - (a.resumen.dia_peso || 0) || (a.demo - b.demo))[0]?.id); }).catch(e => setErr(e.message)); }, []);
  useEffect(() => { if (loteSel) api(`/lotes/${loteSel}`).then(setCurva).catch(() => {}); }, [loteSel]);

  const serie = useMemo(() => curva ? curva.dias.filter(x => x.dia <= Math.max(35, curva.resumen.dia_peso || 0)).map(x => ({ dia: x.dia, estandar: x.peso_std_g, real: x.peso_g })) : [], [curva]);
  if (err) return <div className="card p-6 text-mort-600 font-semibold">{err}</div>;
  if (!d) return <Spinner texto="Calculando indicadores…" />;
  const k = d.kpis;
  const activos = d.lotes.filter(l => l.estado === 'activo');

  return (
    <div>
      <Encabezado migas="Indicadores productivos · Pollo de engorde" titulo="Dashboard ejecutivo">
        <button className="btn-sec" onClick={() => descargar('/reportes/lotes/excel')}><Download size={17} />Exportar Excel</button>
      </Encabezado>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-jhs-500 to-jhs-600 text-white shadow-pop">
          <div className="flex items-center gap-2 text-white/85 text-[11px] font-bold uppercase tracking-wide"><Bird size={17} />Aves vivas (inventario)</div>
          <div className="text-3xl font-extrabold num mt-1">{fmt(k.aves_vivas)}</div>
          <div className="text-xs text-white/85">{k.lotes_activos} lotes en {k.granjas_activas} granjas</div>
        </div>
        <Stat icon={Skull} tono="mort" label="Mortalidad acumulada" value={`${fmt(k.mortalidad_pct, 2)}%`} sub={`Meta de ciclo ${fmt(d.metas.mortalidad_pct, 1)}%`} />
        <Stat icon={Repeat} tono="aba" label="Conversión (FCR)" value={fmt(k.fcr, 2)} sub={<span className={k.fcr > k.fcr_std + 0.05 ? 'text-mort-600 font-bold' : 'text-aba-600 font-bold'}>Estándar a la edad: {fmt(k.fcr_std, 2)}</span>} />
        <Stat icon={Target} tono="peso" label="% Cumplimiento global" value={`${fmt(k.cumplimiento, 0)}%`} sub={k.cumplimiento >= 95 ? '▲ Dentro de meta' : k.cumplimiento >= 90 ? 'Vigilar' : '▼ Bajo meta'} />
      </div>
      <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6">
        <Link to="/panel/lotes" className="rounded-2xl p-3 bg-desc-50 border border-desc-100 flex items-center gap-3"><Clock className="text-desc-600" /><div><div className="text-xl font-extrabold num">{k.capturas_pendientes}</div><div className="text-xs font-semibold text-desc-700">Lotes con captura pendiente hoy</div></div></Link>
        <a href="#alertas" className="rounded-2xl p-3 bg-mort-50 border border-mort-100 flex items-center gap-3"><AlertTriangle className="text-mort-600" /><div><div className="text-xl font-extrabold num">{k.alertas}</div><div className="text-xs font-semibold text-mort-700">Alertas activas</div></div></a>
        <Link to="/panel/discrepancias" className="rounded-2xl p-3 bg-amb-50 border border-amb-100 flex items-center gap-3"><Scale className="text-amb-600" /><div><div className="text-xl font-extrabold num">{k.discrepancias_abiertas}</div><div className="text-xs font-semibold text-amb-700">Cierres detenidos</div></div></Link>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        <div className="card p-5 lg:col-span-3">
          <div className="font-extrabold">% Cumplimiento por indicador</div>
          <div className="text-xs text-carbon-400 mb-3">Ejecutado vs. proyectado · 8 indicadores productivos · base: {d.base_indicadores}</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.indicadores} margin={{ top: 20, right: 0, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EEF1F2" />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 120]} tickFormatter={v => v + '%'} />
                <ReferenceLine y={100} stroke="#9AA8AE" strokeDasharray="4 4" />
                <Tooltip formatter={(v) => `${fmt(v, 1)}%`} />
                <Bar dataKey="cumplimiento" name="% Cumplimiento" radius={[8, 8, 0, 0]}>
                  {d.indicadores.map(i => <Cell key={i.clave} fill={colorCumpl(i.cumplimiento)} />)}
                  <LabelList dataKey="cumplimiento" position="top" formatter={v => v != null ? `${Math.round(v)}%` : ''} style={{ fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead><tr><th className="th">Indicador</th><th className="th text-right">Proyectado</th><th className="th text-right">Ejecutado</th><th className="th text-right">Diferencia</th><th className="th text-right">% Cumpl.</th></tr></thead>
              <tbody>{d.indicadores.map(i => {
                const dec = ['fcr', 'peso'].includes(i.clave) ? 2 : ['mortalidad'].includes(i.clave) ? 2 : ['edad', 'gdp'].includes(i.clave) ? 1 : 0;
                return <tr key={i.clave} className="border-t border-carbon-100"><td className="td font-semibold">{i.nombre}</td><td className="td text-right">{fmt(i.proyectado, dec)}</td><td className="td text-right font-bold">{fmt(i.ejecutado, dec)}</td><td className="td text-right">{fmt(i.diferencia, dec)}</td><td className="td text-right"><span className="font-extrabold" style={{ color: colorCumpl(i.cumplimiento) }}>{fmt(i.cumplimiento, 1)}%</span></td></tr>;
              })}</tbody>
            </table>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2 flex flex-col">
          <div>
            <div className="font-extrabold">Peso promedio — real vs. estándar</div><div className="text-xs text-carbon-400 mb-2">Gramos por día de ciclo</div>
            <select className="input !py-1.5 text-sm" value={loteSel || ''} onChange={e => setLoteSel(Number(e.target.value))}>
              {d.lotes.filter(l => l.resumen.peso_g).map(l => <option key={l.id} value={l.id}>{l.granja} G{l.galpon} · {l.raza}</option>)}
            </select>
          </div>
          <div className="flex-1 min-h-[260px] mt-3">
            <ResponsiveContainer>
              <LineChart data={serie} margin={{ left: -10, right: 8 }}>
                <CartesianGrid stroke="#EEF1F2" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickFormatter={v => 'd' + v} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${fmt(v)} g`} labelFormatter={v => `Día ${v}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="estandar" name="Estándar genético (proyectado)" stroke="#27AAE1" strokeWidth={3} dot={false} />
                <Line dataKey="real" name="Peso real (ejecutado)" stroke="#F37021" strokeWidth={3} connectNulls dot={{ r: 4, fill: '#F37021' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {curva && <div className="grid grid-cols-3 gap-2 text-center mt-2">
            <div className="rounded-xl bg-peso-50 p-2"><div className="text-xs text-peso-700 font-bold">Peso d{curva.resumen.dia_peso}</div><div className="font-extrabold num">{fmt(curva.resumen.peso_g)} g</div></div>
            <div className="rounded-xl bg-carbon-50 p-2"><div className="text-xs text-carbon-500 font-bold">Estándar</div><div className="font-extrabold num">{fmt(curva.resumen.peso_std_g)} g</div></div>
            <div className={`rounded-xl p-2 ${curva.resumen.dif_peso_pct < -5 ? 'bg-mort-50' : 'bg-aba-50'}`}><div className="text-xs font-bold">Diferencia</div><div className="font-extrabold num">{fmt(curva.resumen.dif_peso_pct, 1)}%</div></div>
          </div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        <div className="card lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <div><div className="font-extrabold">Granjas por estado de cumplimiento</div><div className="text-xs text-carbon-400">Semáforo operativo · lotes en curso</div></div>
            <Link to="/panel/lotes" className="text-sm font-bold text-jhs-600 flex items-center">Ver todos<ChevronRight size={16} /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-carbon-50"><tr><th className="th">Granja / lote</th><th className="th text-right">Día</th><th className="th text-right">Aves</th><th className="th text-right">Mort.%</th><th className="th text-right">FCR</th><th className="th text-right">% Cumpl.</th><th className="th">Estado</th></tr></thead>
              <tbody>{[...activos].sort((a, b) => a.resumen.cumplimiento - b.resumen.cumplimiento).map(l => (
                <tr key={l.id} className="border-t border-carbon-100 hover:bg-jhs-50/40">
                  <td className="td font-bold"><Link to={`/panel/lotes/${l.id}`}>{l.granja} <span className="text-carbon-400">G{l.galpon}</span><div className="text-xs font-normal text-carbon-400">{l.codigo}</div></Link></td>
                  <td className="td text-right">{l.resumen.dia_actual}</td>
                  <td className="td text-right">{fmt(l.resumen.saldo)}</td>
                  <td className="td text-right">{fmt(l.resumen.pct_mort, 2)}</td>
                  <td className="td text-right">{fmt(l.resumen.fcr, 2)}</td>
                  <td className="td text-right font-bold">{fmt(l.resumen.cumplimiento, 0)}%</td>
                  <td className="td"><Semaforo s={l.resumen.semaforo} /></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
        <div id="alertas" className="card p-5 lg:col-span-2">
          <div className="font-extrabold mb-3">Alertas</div>
          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {!d.alertas.length && <div className="text-carbon-400 text-sm">Sin alertas activas.</div>}
            {d.alertas.map((a, i) => (
              <Link to={`/panel/lotes/${a.lote_id}`} key={i} className={`flex gap-3 rounded-xl p-3 ${a.nivel === 'alta' ? 'bg-mort-50' : 'bg-desc-50'}`}>
                <AlertTriangle size={18} className={a.nivel === 'alta' ? 'text-mort-600 shrink-0' : 'text-desc-600 shrink-0'} />
                <div className="text-sm"><div className="font-bold">{a.granja} G{a.galpon}</div><div className="text-carbon-600">{a.texto}</div></div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="card p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div><div className="font-extrabold">Comparativo por granja</div><div className="text-xs text-carbon-400">Todos los lotes (en curso y cerrados)</div></div>
            <div className="flex gap-1 bg-carbon-50 rounded-xl p-1">
              {Object.entries(METRICAS).map(([m, [t]]) => <button key={m} onClick={() => setMetrica(m)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${metrica === m ? 'bg-white shadow text-jhs-600' : 'text-carbon-500'}`}>{t}</button>)}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={d.por_granja.filter(g => g[metrica] != null).sort((a, b) => b[metrica] - a[metrica])} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" hide domain={[0, dataMax => dataMax * 1.18]} />
                <YAxis type="category" dataKey="granja" tick={{ fontSize: 12 }} width={110} />
                <Tooltip formatter={v => fmt(v, METRICAS[metrica][1])} />
                <Bar dataKey={metrica} name={METRICAS[metrica][0]} radius={[0, 8, 8, 0]} fill={{ fcr: '#3FA34D', mortalidad: '#E5484D', iee: '#8E6CEF', cumplimiento: '#F37021' }[metrica]}>
                  <LabelList dataKey={metrica} position="right" formatter={v => fmt(v, METRICAS[metrica][1])} style={{ fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <div className="font-extrabold mb-1">Comparativo por línea genética</div>
          <div className="text-xs text-carbon-400 mb-3">Promedios ponderados por aves alojadas</div>
          <div className="space-y-3">
            {d.por_raza.map((r, i) => (
              <div key={r.raza} className="rounded-2xl p-4" style={{ background: ['#FFF4EC', '#EDF8FD', '#F3EFFE', '#EDF8EF'][i % 4] }}>
                <div className="flex justify-between font-extrabold"><span>{r.raza}</span><span className="text-carbon-400 text-sm">{r.lotes} lotes</span></div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-center text-sm">
                  <div><div className="text-[10px] font-bold text-carbon-400 uppercase">Mort.</div><div className="font-extrabold num">{fmt(r.mortalidad, 2)}%</div></div>
                  <div><div className="text-[10px] font-bold text-carbon-400 uppercase">FCR</div><div className="font-extrabold num">{fmt(r.fcr, 2)}</div></div>
                  <div><div className="text-[10px] font-bold text-carbon-400 uppercase">IEE</div><div className="font-extrabold num">{fmt(r.iee)}</div></div>
                  <div><div className="text-[10px] font-bold text-carbon-400 uppercase">Peso vs std</div><div className={`font-extrabold num ${r.dif_peso < -5 ? 'text-mort-600' : ''}`}>{fmt(r.dif_peso, 1)}%</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
