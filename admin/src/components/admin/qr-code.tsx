'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code vectoriel (net à l'impression). */
export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#15171c', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [value]);
  if (!svg) return <div style={{ width: size, height: size }} className="bg-paper-2" />;
  return <div role="img" aria-label={`QR code vers ${value}`} className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export async function qrPngDataUrl(value: string, width = 1024) {
  return QRCode.toDataURL(value, { width, margin: 2, errorCorrectionLevel: 'M' });
}
