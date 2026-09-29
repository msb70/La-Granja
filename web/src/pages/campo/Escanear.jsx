import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { ScanLine, CameraOff, ArrowLeft } from 'lucide-react';

/** Lector de QR dentro de la app (útil cuando está instalada en el teléfono) */
export default function Escanear() {
  const nav = useNavigate();
  const video = useRef(null);
  const canvas = useRef(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let stream, raf, activo = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!activo) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = () => {
          const v = video.current, c = canvas.current;
          if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
            c.width = v.videoWidth; c.height = v.videoHeight;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              const m = /\/g\/(\d+)/.exec(code.data);
              if (m) { if (navigator.vibrate) navigator.vibrate(80); nav(`/g/${m[1]}`, { replace: true }); return; }
              setAviso('Este código no es de un galpón de El Dorado.');
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Permita el acceso a la cámara para escanear.' : 'No se pudo abrir la cámara de este dispositivo.');
      }
    })();
    return () => { activo = false; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
  }, [nav]);

  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100vh-8rem)] bg-carbon-900 text-white flex flex-col">
      <div className="p-4 flex items-center gap-2"><button onClick={() => nav(-1)} className="p-1" aria-label="Volver"><ArrowLeft /></button><div><div className="font-extrabold text-lg">Escanear galpón</div><div className="text-sm text-white/60">Apunte al código QR pegado en el galpón</div></div></div>
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center"><CameraOff size={48} className="text-white/50" /><div className="font-bold">{error}</div><div className="text-sm text-white/60">También puede escanear con la cámara normal del teléfono: el enlace abre la app.</div></div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-64 h-64 rounded-3xl border-4 border-jhs-500 shadow-[0_0_0_9999px_rgba(0,0,0,.45)] relative"><ScanLine className="absolute -top-10 left-1/2 -translate-x-1/2 text-jhs-400" size={28} /></div>
          </div>
          {aviso && <div className="absolute bottom-6 inset-x-4 rounded-2xl bg-mort-600 p-3 text-center font-semibold">{aviso}</div>}
        </div>
      )}
      <canvas ref={canvas} hidden />
    </div>
  );
}
