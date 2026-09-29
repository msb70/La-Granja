import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Código QR en SVG (nítido al imprimir) */
export default function QR({ texto, size = 180, className = '' }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1F292E', light: '#FFFFFF' } })
      .then(setSvg).catch(() => setSvg(''));
  }, [texto]);
  return <div className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} aria-label={`Código QR: ${texto}`} role="img" />;
}

export const urlGalpon = (id) => `${window.location.origin}/g/${id}`;
