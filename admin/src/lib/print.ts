'use client';

/**
 * Impression d'un document isolé (bon de dépôt, ticket de caisse) dans un cadre invisible :
 * seule la pièce est imprimée, sur une page, sans le reste de l'interface.
 * - `a4` : feuille A4 portrait, marges 12 mm ;
 * - `ticket` : rouleau thermique 80 mm (largeur utile ~72 mm), hauteur libre.
 */
export type PrintFormat = 'a4' | 'ticket';

export const esc = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const STYLES: Record<PrintFormat, string> = {
  a4: `@page { size: A4 portrait; margin: 12mm; }
    body { font: 12.5px/1.45 'IBM Plex Sans', Arial, sans-serif; }
    .doc { max-height: 270mm; overflow: hidden; }`,
  ticket: `@page { size: 80mm auto; margin: 3mm 4mm; }
    body { font: 11.5px/1.35 'IBM Plex Mono', 'Courier New', monospace; width: 72mm; }`,
};

const BASE = `* { box-sizing: border-box; margin: 0; padding: 0; }
  body { color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 1.6em; } .muted { color: #555; } .right { text-align: right; } .center { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 8px; } .bold { font-weight: 600; }
  .rule { border-top: 1px solid #000; margin: 8px 0; } .dash { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font: inherit; } td, th { font: inherit; padding: 3px 0; vertical-align: top; text-align: left; } th { color: #555; font-weight: 400; }
  .code { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-weight: 700; letter-spacing: .12em; }`;

export function printDocument(title: string, body: string, format: PrintFormat) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE}${STYLES[format]}</style></head><body><div class="doc">${body}</div></body></html>`);
  doc.close();
  const images = [...doc.images].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r))));
  void Promise.all(images).then(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    // Retiré après l'impression (délai : certains navigateurs impriment de façon asynchrone).
    setTimeout(() => frame.remove(), 60_000);
  });
}
