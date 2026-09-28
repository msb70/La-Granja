import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageOpen, WifiOff } from 'lucide-react';
import { useApp } from '../../lib/store.jsx';
import { api, hoy } from '../../lib/api.js';
import { Campo, Vacio } from '../../components/ui.jsx';

export default function AperturaLote() {
  const { galponId } = useParams();
  const nav = useNavigate();
  const { boot, online, aviso, recargar } = useApp();
  const ga = boot?.galpones.find(g => g.id === Number(galponId));
  const granja = boot?.granjas.find(g => g.id === ga?.granja_id);
  const sugerido = granja ? `${granja.nombre.split(/\s+/).map(w => w[0]).join('').toUpperCase()}-G${ga.numero}-` : '';
  const [f, setF] = useState({ codigo: '', fecha_entrada: hoy(), aves_alojadas: '', incubadora: boot?.incubadoras?.[0] || 'JHS', raza_id: boot?.razas?.[0]?.id || '', peso_inicial_g: '42', observaciones: '' });
  const [enviando, setEnviando] = useState(false);
  if (!ga) return <Vacio titulo="Galpón no encontrado" />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const abrir = async () => {
    if (!(Number(f.aves_alojadas) > 0)) return aviso('Indique las aves alojadas', 'error');
    setEnviando(true);
    try {
      const r = await api('/lotes', { method: 'POST', body: { ...f, galpon_id: ga.id, raza_id: Number(f.raza_id), aves_alojadas: Number(f.aves_alojadas), peso_inicial_g: Number(f.peso_inicial_g) || 42, codigo: f.codigo || undefined } });
      await recargar();
      aviso(`Lote ${r.codigo} abierto`);
      nav(`/campo/lote/${r.id}`, { replace: true });
    } catch (e) { aviso(e.message, 'error'); } finally { setEnviando(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-carbon-500 font-semibold"><ArrowLeft size={18} />Volver</button>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-12 h-12 rounded-2xl bg-carbon-800 text-white"><PackageOpen size={24} /></span>
        <div><h1 className="text-2xl font-extrabold">Apertura de lote</h1><div className="text-carbon-500">{granja.nombre} · Galpón {ga.numero}</div></div>
      </div>
      {!online && <div className="rounded-2xl bg-carbon-800 text-white p-4 flex gap-3"><WifiOff className="shrink-0" />La apertura de lote necesita conexión: el servidor asigna el código y el estándar genético. Las capturas diarias sí funcionan sin señal.</div>}
      <div className="card p-5 space-y-4">
        <Campo label="Código de lote" ayuda="Déjelo vacío para generarlo automáticamente"><input className="input uppercase" placeholder={`${sugerido}${f.fecha_entrada.slice(2).replace(/-/g, '')}`} value={f.codigo} onChange={set('codigo')} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha de entrada"><input type="date" className="input" max={hoy()} value={f.fecha_entrada} onChange={set('fecha_entrada')} /></Campo>
          <Campo label="Aves alojadas"><input className="input text-lg font-bold" inputMode="numeric" value={f.aves_alojadas} onChange={e => setF({ ...f, aves_alojadas: e.target.value.replace(/\D/g, '') })} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Incubadora"><select className="input" value={f.incubadora} onChange={set('incubadora')}>{boot.incubadoras.map(i => <option key={i}>{i}</option>)}</select></Campo>
          <Campo label="Raza / estándar genético"><select className="input" value={f.raza_id} onChange={set('raza_id')}>{boot.razas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></Campo>
        </div>
        <Campo label="Peso inicial del pollito (g)"><input className="input" inputMode="numeric" value={f.peso_inicial_g} onChange={set('peso_inicial_g')} /></Campo>
        <Campo label="Observaciones"><textarea className="input" rows={2} value={f.observaciones} onChange={set('observaciones')} placeholder="Lote sin novedades al ingreso" /></Campo>
      </div>
      <button className="btn btn-big bg-aba-500 text-white shadow-card" onClick={abrir} disabled={!online || enviando}>{enviando ? 'Abriendo…' : 'Abrir lote'}</button>
    </div>
  );
}
