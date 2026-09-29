import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Clock, Save, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp } from '../../lib/store.jsx';
import { conPendientes, diffDias, encolar, fmt, hoy, stdAt, uuid, addDays, fmtFecha } from '../../lib/api.js';
import { MODULOS, CAUSAS_MORT, MOTIVOS_DESC, FASES, faseDe } from '../../lib/modulos.js';
import Fotos from '../../components/Fotos.jsx';
import { Vacio } from '../../components/ui.jsx';

function Stepper({ value, onChange, color }) {
  const set = (v) => onChange(Math.max(0, v));
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" onClick={() => set(value - 1)} className={`w-16 h-16 rounded-full ${color} text-white grid place-items-center shadow-card active:scale-90 transition`} aria-label="Restar"><Minus size={30} /></button>
      <input inputMode="numeric" className="w-32 text-center text-6xl font-extrabold num bg-transparent outline-none" value={value}
        onChange={e => set(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} aria-label="Cantidad" />
      <button type="button" onClick={() => set(value + 1)} className={`w-16 h-16 rounded-full ${color} text-white grid place-items-center shadow-card active:scale-90 transition`} aria-label="Sumar"><Plus size={30} /></button>
    </div>
  );
}

const Chips = ({ opciones, value, onChange, activo }) => (
  <div className="flex flex-wrap gap-2">
    {opciones.map(o => { const v = o.v ?? o, t = o.t ?? o; return (
      <button type="button" key={v} onClick={() => onChange(v)} className={`px-3.5 py-2 rounded-xl font-bold text-sm border-2 transition ${value === v ? `${activo} text-white border-transparent` : 'bg-white border-carbon-200 text-carbon-600'}`}>{t}</button>
    ); })}
  </div>
);

export default function Captura() {
  const { id, tipo } = useParams();
  const nav = useNavigate();
  const { boot, outbox, aviso, online } = useApp();
  const lote = useMemo(() => conPendientes(boot?.lotes.find(l => l.id === Number(id)), outbox), [boot, outbox, id]);
  const m = MODULOS[tipo];
  const [fecha, setFecha] = useState(hoy());
  const [cant, setCant] = useState(0);
  const [kg, setKg] = useState('');
  const [causa, setCausa] = useState(tipo === 'mortalidad' ? 'otra' : MOTIVOS_DESC[0]);
  const [peso, setPeso] = useState('');
  const [muestra, setMuestra] = useState('100');
  const [temp, setTemp] = useState('');
  const [hum, setHum] = useState('');
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [faseSel, setFaseSel] = useState(null);
  if (!lote || !m) return <Vacio titulo="Lote no disponible" />;

  const r = lote.resumen;
  const dia = diffDias(lote.fecha_entrada, fecha);
  const fase = faseDe(dia, boot.config.fases_aba);
  const faseFinal = faseSel || fase;
  const est = boot.estandares[lote.raza_id] || [];
  const pesoStd = stdAt(est, dia);
  const difPeso = peso && pesoStd ? (Number(peso) - pesoStd) / pesoStd * 100 : null;
  const grAve = kg && r.saldo ? Number(kg) * 1000 / r.saldo : null;
  const abaAyer = [...lote.dias].reverse().find(d => d.aba_kg > 0 && d.fecha < fecha)?.aba_kg;
  const saltoAba = kg && abaAyer ? Math.abs(Number(kg) - abaAyer) / abaAyer : 0;
  const fotoObligatoria = tipo === 'mortalidad' && causa === 'patologica' && cant > 0;
  const minFecha = lote.fecha_entrada > addDays(hoy(), -7) ? lote.fecha_entrada : addDays(hoy(), -7);

  const guardar = async () => {
    const cap = { id: uuid(), lote_id: lote.id, fecha, tipo, observaciones: obs || null, capturado_en: new Date().toISOString() };
    if (tipo === 'mortalidad' || tipo === 'descarte') {
      if (cant > r.saldo) return aviso(`No puede superar el saldo de aves (${fmt(r.saldo)})`, 'error');
      if (fotoObligatoria && !fotos.length) return aviso('La mortalidad patológica requiere al menos una foto', 'error');
      Object.assign(cap, { cantidad: cant, causa });
    } else if (tipo === 'aba') {
      if (kg === '' || Number(kg) < 0) return aviso('Indique los kg servidos', 'error');
      Object.assign(cap, { cantidad: Number(kg), fase: faseFinal });
    } else if (tipo === 'pesaje') {
      if (!(Number(peso) > 0)) return aviso('Indique el peso promedio en gramos', 'error');
      Object.assign(cap, { peso_g: Number(peso), muestra: Number(muestra) || null });
    } else if (tipo === 'ambiente') {
      if (temp === '' && hum === '') return aviso('Indique temperatura o humedad', 'error');
      Object.assign(cap, { temperatura: temp === '' ? null : Number(temp), humedad: hum === '' ? null : Number(hum) });
    }
    setGuardando(true);
    await encolar('captura', cap);
    for (const f of fotos) await encolar('foto', { id: uuid(), captura_id: cap.id, lote_id: lote.id, ref_tipo: 'captura', ref_id: cap.id, data: f });
    aviso(online ? 'Guardado. Sincronizando…' : 'Guardado en el teléfono. Se enviará al recuperar señal.');
    nav(`/campo/lote/${lote.id}`, { replace: true });
  };

  const I = m.icon;
  const curva = tipo === 'pesaje' ? Array.from({ length: Math.max(8, dia + 3) }, (_, d) => ({
    dia: d, estandar: Math.round(stdAt(est, d)), real: (lote.pesajes || []).find(p => p.dia === d)?.peso_g ?? (d === dia && peso ? Number(peso) : null),
  })) : [];

  return (
    <div className="-mx-4 -mt-4">
      <div className={`${m.bg} text-white px-4 pt-3 pb-6 rounded-b-3xl`}>
        <button onClick={() => nav(-1)} className="flex items-center gap-1 font-semibold opacity-90"><ArrowLeft size={18} />{lote.granja} · G{lote.galpon}</button>
        <div className="flex items-center gap-3 mt-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/20"><I size={26} /></span>
          <div><h1 className="text-2xl font-extrabold leading-tight">{m.titulo}</h1><div className="text-sm opacity-90">Lote {lote.codigo}</div></div>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-4 pb-10">
        <div className="card p-3 flex items-center justify-between gap-3">
          <span className="chip bg-carbon-800 text-white py-1 px-3"><Clock size={13} />Día de ciclo {dia} (automático)</span>
          <input type="date" className="input !w-auto !py-1.5 text-sm" value={fecha} min={minFecha} max={hoy()} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Fecha" />
        </div>

        {(tipo === 'mortalidad' || tipo === 'descarte') && (
          <div className="card p-5 space-y-5">
            <div className="text-center label">{tipo === 'mortalidad' ? 'Aves muertas' : 'Aves descartadas'} {fecha === hoy() ? 'hoy' : fmtFecha(fecha)}</div>
            <Stepper value={cant} onChange={setCant} color={m.bg} />
            <div>
              <span className="label">{tipo === 'mortalidad' ? 'Causa' : 'Motivo'}</span>
              <Chips opciones={tipo === 'mortalidad' ? CAUSAS_MORT : MOTIVOS_DESC} value={causa} onChange={setCausa} activo={m.bg} />
            </div>
            <div className={`rounded-2xl ${m.soft} p-4 space-y-1.5 text-sm`}>
              <div className="flex justify-between"><span className="font-semibold">Mortalidad acumulada</span><b className="num">{fmt(r.mort_acum + (tipo === 'mortalidad' ? cant : 0))} aves</b></div>
              <div className="flex justify-between"><span className="font-semibold">Descarte acumulado</span><b className="num">{fmt(r.desc_acum + (tipo === 'descarte' ? cant : 0))} aves</b></div>
              <div className="flex justify-between border-t border-black/5 pt-1.5"><span className="font-semibold">Saldo de aves (auto)</span><b className="num text-lg">{fmt(r.saldo - cant)}</b></div>
            </div>
            {cant > r.saldo && <div className="text-mort-600 font-bold text-sm">La cantidad supera el saldo actual de aves.</div>}
          </div>
        )}

        {tipo === 'aba' && (
          <div className="card p-5 space-y-4">
            <label className="block"><span className="label">Kg de alimento servidos {fecha === hoy() ? 'hoy' : ''}</span>
              <div className="relative"><input className="input-big text-aba-700 pr-14" inputMode="decimal" value={kg} onChange={e => setKg(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))} placeholder="0" autoFocus /><span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-carbon-400">kg</span></div>
            </label>
            <div><span className="label">Fase (según día de ciclo)</span><Chips opciones={Object.entries(FASES).map(([v, t]) => ({ v, t }))} value={faseFinal} onChange={setFaseSel} activo={m.bg} /></div>
            <div className="rounded-2xl bg-aba-50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="font-semibold">g / ave / día (auto)</span><b className="num">{fmt(grAve, 1)} g</b></div>
              <div className="flex justify-between"><span className="font-semibold">ABA acumulado</span><b className="num">{fmt(r.aba_acum_kg + (Number(kg) || 0))} kg</b></div>
              <div className="flex justify-between"><span className="font-semibold">Consumo anterior</span><b className="num">{abaAyer != null ? `${fmt(abaAyer)} kg` : '—'}</b></div>
            </div>
            {saltoAba > 0.4 && <div className="flex gap-2 text-desc-700 bg-desc-50 rounded-xl p-3 text-sm font-semibold"><Info size={18} className="shrink-0" />El valor difiere más de 40% del día anterior. Verifique antes de guardar.</div>}
          </div>
        )}

        {tipo === 'pesaje' && (
          <div className="card p-5 space-y-4">
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <label className="block"><span className="label">Peso real promedio</span>
                <div className="relative"><input className="input-big text-peso-700 pr-10" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" autoFocus /><span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-carbon-400">g</span></div>
              </label>
              <label className="block"><span className="label">Muestra</span><input className="input-big" inputMode="numeric" value={muestra} onChange={e => setMuestra(e.target.value.replace(/\D/g, ''))} /></label>
            </div>
            <div className="rounded-2xl bg-peso-50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="font-semibold">Estándar genético ({lote.raza}) día {dia}</span><b className="num">{fmt(pesoStd)} g</b></div>
              <div className="flex justify-between"><span className="font-semibold">% diferencia (auto)</span><b className={`num text-lg ${difPeso == null ? '' : difPeso < -5 ? 'text-mort-600' : 'text-aba-600'}`}>{difPeso == null ? '—' : `${difPeso > 0 ? '+' : ''}${fmt(difPeso, 1)}%`}</b></div>
            </div>
            <div>
              <span className="label">Tendencia vs. estándar</span>
              <div className="h-44 -ml-4">
                <ResponsiveContainer>
                  <LineChart data={curva}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={44} />
                    <Tooltip formatter={(v) => `${fmt(v)} g`} labelFormatter={(d) => `Día ${d}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line isAnimationActive={false} dataKey="estandar" name="Estándar" stroke="#27AAE1" strokeWidth={2.5} dot={false} />
                    <Line isAnimationActive={false} dataKey="real" name="Real" stroke="#F37021" strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tipo === 'ambiente' && (
          <div className="card p-5 grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Temperatura °C</span><input className="input-big text-amb-700" inputMode="decimal" value={temp} onChange={e => setTemp(e.target.value.replace(',', '.').replace(/[^\d.-]/g, ''))} autoFocus /></label>
            <label className="block"><span className="label">Humedad %</span><input className="input-big text-amb-700" inputMode="decimal" value={hum} onChange={e => setHum(e.target.value.replace(/[^\d.]/g, ''))} /></label>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <label className="block"><span className="label">Observaciones</span><textarea className="input" rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Sin novedades relevantes" /></label>
          <Fotos value={fotos} onChange={setFotos} obligatorio={fotoObligatoria} />
        </div>

        <div className="sticky bottom-24 pb-2 z-10">
          <button className={`btn btn-big text-white ${m.bg} shadow-card`} onClick={guardar} disabled={guardando}><Save size={22} />Guardar captura</button>
        </div>
      </div>
    </div>
  );
}
