import { useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { comprimirFoto } from '../lib/api.js';

/** Selector de evidencias fotográficas numeradas. value: [dataUrl] */
export default function Fotos({ value, onChange, max = 6, obligatorio }) {
  const ref = useRef();
  const agregar = async (e) => {
    const files = [...e.target.files].slice(0, max - value.length);
    const nuevas = [];
    for (const f of files) nuevas.push(await comprimirFoto(f));
    onChange([...value, ...nuevas]);
    e.target.value = '';
  };
  return (
    <div>
      <span className="label">Evidencia fotográfica {obligatorio && <span className="text-mort-600">· obligatoria</span>}</span>
      <div className="grid grid-cols-3 gap-2.5">
        {value.map((src, i) => (
          <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-carbon-100">
            <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <span className="absolute left-1.5 top-1.5 bg-carbon-900/70 text-white text-xs font-bold rounded-lg px-1.5">#{i + 1}</span>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 bg-white rounded-full p-1 shadow" aria-label="Quitar foto"><X size={14} /></button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => ref.current.click()} className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 font-semibold text-sm ${obligatorio && !value.length ? 'border-mort-500 text-mort-600 bg-mort-50' : 'border-carbon-200 text-carbon-400'}`}>
            <Camera size={26} />Foto {value.length + 1}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden onChange={agregar} />
    </div>
  );
}
