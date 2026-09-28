import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, AlertTriangle, BadgeCheck, LayoutDashboard, Star } from 'lucide-react';
import { useApp, puede } from '../../lib/store.jsx';
import { api, conPendientes, fmt, fmtFecha, hoy } from '../../lib/api.js';
import { MODULOS, FASES } from '../../lib/modulos.js';
import { Vacio } from '../../components/ui.jsx';

export default function LoteCampo() {
  const { id } = useParams();
  const nav = useNavigate();
  const { boot, outbox, user, aviso, online } = useApp();
  const [validando, setValidando] = useState(false);
  const lote = useMemo(() => conPendientes(boot?.lotes.find(l => l.id === Number(id)), outbox), [boot, outbox, id]);
  if (!lote) return <Vacio titulo="Lote no disponible" texto="Puede que ya esté cerrado o que no tenga acceso."><Link to="/campo" className="btn-primary mt-3">Volver</Link></Vacio>;
  const r = lote.resumen;
  const esHito = (boot.config.dias_hito || []).includes(r.dia_actual);
  const regHoy = new Set([...(lote.dias.find(d => d.fecha === hoy())?.registrado || []), ...Object.keys(lote.hoyLocal || {})]);

  const validar = async () => {
    if (!online) return aviso('Necesita conexión para validar el día', 'error');
    setValidando(true);
    try { await api(`/lotes/${lote.id}/validar-dia`, { method: 'POST', body: { fecha: hoy() } }); aviso('Día validado'); }
    catch (e) { aviso(e.message, 'error'); } finally { setValidando(false); }
  };

  const tiles = [
    ['mortalidad', `Hoy: ${lote.hoyLocal?.mortalidad ?? lote.dias.find(d => d.fecha === hoy())?.mortalidad ?? 0} aves`],
    ['aba', `Fase ${FASES[r.fase_aba]}`],
    ['pesaje', esHito ? 'Hoy es día hito' : `Último: día ${r.dia_peso ?? '—'}`],
    ['descarte', `Acum: ${fmt(r.desc_acum)} aves`],
    ['ambiente', 'Temperatura y humedad'],
    ['despacho', `Despachadas: ${fmt(r.aves_despachadas)}`],
  ];

  return (
    <div className="space-y-4">
      <button onClick={() => nav('/campo')} className="flex items-center gap-1 text-carbon-500 font-semibold -ml-1"><ArrowLeft size={18} />Mis granjas</button>

      <div className="rounded-3xl bg-gradient-to-br from-carbon-700 to-carbon-900 text-white p-5 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-jhs-500/30" />
        <div className="relative flex justify-between items-start">
          <div>
            <div className="text-white/60 text-sm font-semibold">{lote.codigo} · {lote.raza}</div>
            <div className="text-2xl font-extrabold">{lote.granja} · Galpón {lote.galpon}</div>
            <div className="text-white/60 text-sm">Entrada {fmtFecha(lote.fecha_entrada, { day: '2-digit', month: 'short', year: 'numeric' })} · {fmt(lote.aves_alojadas)} aves</div>
          </div>
          <div className="text-center bg-jhs-500 rounded-2xl px-3 py-2 shadow-pop">
            <div className="text-[10px] font-bold uppercase">Día</div>
            <div className="text-3xl font-extrabold num leading-none">{r.dia_actual}</div>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/60 font-semibold">Saldo de aves</div><div className="text-2xl font-extrabold num">{fmt(r.saldo)}</div></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/60 font-semibold">Mortalidad acum.</div><div className="text-2xl font-extrabold num">{fmt(r.mort_acum)} <span className="text-base text-mort-100">{fmt(r.pct_mort, 2)}%</span></div></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/60 font-semibold">ABA acumulado</div><div className="text-2xl font-extrabold num">{fmt(r.aba_acum_kg)} <span className="text-base">kg</span></div></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="text-xs text-white/60 font-semibold">Peso vs estándar</div><div className="text-2xl font-extrabold num">{fmt(r.peso_g)} g {r.dif_peso_pct != null && <span className={`text-base ${r.dif_peso_pct < -5 ? 'text-mort-100' : 'text-aba-100'}`}>{r.dif_peso_pct > 0 ? '+' : ''}{fmt(r.dif_peso_pct, 1)}%</span>}</div></div>
        </div>
      </div>

      {r.alertas.length > 0 && (
        <div className="rounded-2xl bg-mort-50 border border-mort-100 p-3 space-y-1">
          {r.alertas.map((a, i) => <div key={i} className="flex gap-2 text-sm font-semibold text-mort-700"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{a.texto}</div>)}
        </div>
      )}

      <h2 className="label !mb-0">Registrar hoy</h2>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(([k, sub]) => {
          const m = MODULOS[k]; const I = m.icon;
          const hecho = regHoy.has(k);
          const to = k === 'despacho' ? `/campo/lote/${lote.id}/despacho` : `/campo/lote/${lote.id}/captura/${k}`;
          return (
            <Link key={k} to={to} className={`relative rounded-3xl ${m.bg} text-white p-4 min-h-[118px] flex flex-col justify-between shadow-card active:scale-[.97] transition`}>
              <div className="flex justify-between items-start">
                <span className="grid place-items-center w-11 h-11 rounded-2xl bg-white/20"><I size={24} /></span>
                {k !== 'despacho' && k !== 'ambiente' && k !== 'descarte' && (hecho ? <CheckCircle2 size={22} /> : (k !== 'pesaje' || esHito) ? <Circle size={22} className="opacity-60" /> : null)}
                {k === 'pesaje' && esHito && !hecho && <Star size={18} className="absolute top-3 right-10 fill-white" />}
              </div>
              <div><div className="font-extrabold text-lg leading-tight">{m.titulo}</div><div className="text-xs font-semibold opacity-90">{sub}</div></div>
            </Link>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 pt-4 pb-2 font-extrabold">Últimos días</div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-carbon-50"><th className="th">Día</th><th className="th text-right">Muertes</th><th className="th text-right">ABA kg</th><th className="th text-right">g/ave</th><th className="th text-right">Peso</th></tr></thead>
          <tbody>
            {[...lote.dias].reverse().slice(0, 7).map(d => (
              <tr key={d.dia} className="border-t border-carbon-100">
                <td className="td font-bold">{d.dia} <span className="text-carbon-400 font-normal">{fmtFecha(d.fecha)}</span></td>
                <td className="td text-right text-mort-600 font-bold">{d.registrado.includes('mortalidad') ? d.mortalidad : '—'}</td>
                <td className="td text-right">{d.registrado.includes('aba') ? fmt(d.aba_kg) : '—'}</td>
                <td className="td text-right">{fmt(d.gr_ave_dia, 1)}</td>
                <td className="td text-right">{d.peso_g ? `${fmt(d.peso_g)} g` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="flex flex-col gap-2 pb-4">
        {puede(user, 'productor', 'coordinacion', 'veterinario') && (
          <button className="btn-sec btn-big" onClick={validar} disabled={validando}><BadgeCheck size={20} className="text-aba-600" />Validar registros de hoy</button>
        )}
        {puede(user, 'productor', 'coordinacion', 'veterinario', 'gerencia') && (
          <Link to={`/panel/lotes/${lote.id}`} className="btn-ghost"><LayoutDashboard size={18} />Ver ficha completa y cierre del lote</Link>
        )}
      </div>
    </div>
  );
}
