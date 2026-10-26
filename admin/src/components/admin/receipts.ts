'use client';

import { api } from '@/lib/api';
import type { RepairDetail } from '@/lib/admin-types';
import { formatDate, formatDateTime, formatPhone, formatPrice } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/labels';
import { esc, printDocument, type PrintFormat } from '@/lib/print';
import { qrPngDataUrl } from './qr-code';

interface Shop {
  shopName: string;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  siteUrl?: string;
}

interface ReviewCode {
  code: string | null;
  usable: boolean;
  waitingFor: string | null;
}

export interface TicketOrder {
  id: string;
  number: string;
  createdAt: string;
  customerName: string;
  total: number;
  amountPaid: number;
  createdBy: { name: string } | null;
  items: { label: string; quantity: number; unitPrice: number; lineTotal: number }[];
  payments: { kind: 'PAYMENT' | 'REFUND'; method: string; status: string; amount: number }[];
}

const shop = () => api.get<Shop>('/settings/public');
const groupCode = (code: string) => code.replace(/(.{4})(?=.)/g, '$1-');

function header(s: Shop, title: string, format: PrintFormat) {
  const address = [s.addressLine, s.city].filter(Boolean).join(', ');
  return `<div class="${format === 'ticket' ? 'center' : ''}">
    <h1>${esc(s.shopName)}</h1>
    ${address ? `<p>${esc(address)}</p>` : ''}
    ${s.phone ? `<p>Tél. ${esc(formatPhone(s.phone))}</p>` : ''}
    <p class="bold" style="margin-top:6px">${esc(title)}</p>
  </div>`;
}

/** Bloc « Votre avis » : code et QR code ; vide si un avis a déjà été donné ou si le code est indisponible. */
async function reviewBlock(kind: 'reparation' | 'vente', id: string, siteUrl: string | undefined, format: PrintFormat) {
  let code: ReviewCode;
  try {
    code = await api.get<ReviewCode>(`/review-codes/${kind}/${id}`);
  } catch {
    return '';
  }
  if (!code.code) return '';
  const link = siteUrl ? `${siteUrl}/avis/laisser?code=${code.code}` : null;
  const qr = link ? await qrPngDataUrl(link, 320) : null;
  const size = format === 'ticket' ? '30mm' : '28mm';
  return `<div class="${format === 'ticket' ? 'dash' : 'rule'}"></div>
    <div style="display:flex;gap:10px;align-items:center;${format === 'ticket' ? 'flex-direction:column;text-align:center' : ''}">
      ${qr ? `<img src="${qr}" alt="" style="width:${size};height:${size}">` : ''}
      <div>
        <p class="bold">Votre avis compte</p>
        <p>Code d’avis : <span class="code" style="font-size:1.35em">${esc(groupCode(code.code))}</span></p>
        <p class="muted">${link ? `Scannez le QR code ou saisissez ce code sur ${esc(siteUrl!.replace(/^https?:\/\//, ''))}/avis/laisser` : 'À saisir sur la page « Avis » du site'}${code.usable ? '' : `, après ${esc(code.waitingFor)}`}.</p>
      </div>
    </div>`;
}

/** Bon de dépôt d'une réparation : une page A4, avec le code d'avis. */
export async function printDepositSlip(repair: RepairDetail) {
  const s = await shop();
  const rows: [string, string][] = [
    ['Client', `${repair.customer.name} · ${formatPhone(repair.customer.phone)}`],
    ['Appareil', `${repair.brandName} ${repair.modelName}${repair.imeiLast4 ? ` · IMEI …${repair.imeiLast4}` : ''}`],
    ['Panne signalée', repair.reportedIssue],
    ['Montant convenu', repair.billedAmount ? formatPrice(repair.billedAmount) : 'Sur devis après diagnostic'],
    ...(repair.amountPaid ? ([['Déjà réglé', formatPrice(repair.amountPaid)], ['Reste à payer', formatPrice(repair.balanceDue)]] as [string, string][]) : []),
    ['Date prévue', repair.dueAt ? formatDate(repair.dueAt) : '—'],
  ];
  const body = `${header(s, 'Bon de dépôt — réparation', 'a4')}
    <div class="row" style="margin-top:10px"><span>N° <span class="code">${esc(repair.number)}</span></span><span>${esc(formatDateTime(repair.receivedAt))}</span></div>
    <div class="rule"></div>
    <table>${rows.map(([k, v]) => `<tr><th style="width:38%" class="muted">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    ${await reviewBlock('reparation', repair.id, s.siteUrl, 'a4')}
    <div class="rule"></div>
    <p class="muted" style="font-size:11px">Aucune intervention n’est réalisée sans votre accord sur le devis. Conservez ce bon : il est demandé lors du retrait de l’appareil.</p>
    <div class="row" style="margin-top:28px"><span>Signature du client</span><span>Pour ${esc(s.shopName)}</span></div>`;
  printDocument(`Bon de dépôt ${repair.number}`, body, 'a4');
}

/** Ticket de caisse (rouleau 80 mm), avec le code d'avis. */
export async function printSaleTicket(order: TicketOrder) {
  const s = await shop();
  const paid = order.payments.filter((p) => p.kind === 'PAYMENT' && p.status === 'CONFIRMED');
  const body = `${header(s, 'Ticket de caisse', 'ticket')}
    <div class="dash"></div>
    <div class="row"><span>${esc(order.number)}</span><span>${esc(formatDateTime(order.createdAt))}</span></div>
    ${order.customerName ? `<p>Client : ${esc(order.customerName)}</p>` : ''}
    <div class="dash"></div>
    <table>${order.items
      .map((i) => `<tr><td colspan="2">${esc(i.label)}</td></tr><tr><td class="muted">${i.quantity} × ${esc(formatPrice(i.unitPrice))}</td><td class="right">${esc(formatPrice(i.lineTotal))}</td></tr>`)
      .join('')}</table>
    <div class="dash"></div>
    <div class="row bold" style="font-size:1.25em"><span>TOTAL</span><span>${esc(formatPrice(order.total))}</span></div>
    ${paid.map((p) => `<div class="row"><span>${esc(PAYMENT_METHODS[p.method] ?? p.method)}</span><span>${esc(formatPrice(p.amount))}</span></div>`).join('')}
    ${order.amountPaid < order.total ? `<div class="row bold"><span>Reste à payer</span><span>${esc(formatPrice(order.total - order.amountPaid))}</span></div>` : ''}
    ${await reviewBlock('vente', order.id, s.siteUrl, 'ticket')}
    <div class="dash"></div>
    <p class="center">Merci de votre visite !</p>
    ${order.createdBy ? `<p class="center muted">Vendeur : ${esc(order.createdBy.name)}</p>` : ''}`;
  printDocument(`Ticket ${order.number}`, body, 'ticket');
}
