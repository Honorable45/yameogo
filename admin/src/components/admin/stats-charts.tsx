'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { formatAmount, formatPrice } from '@/lib/format';

/**
 * Couleurs des activités — palette validée (lisibilité daltonisme, contraste sur fond blanc).
 * L'ordre est fixe : une activité garde toujours sa couleur.
 */
export const ACTIVITY_COLORS = { accessories: '#3461b5', phones: '#d4782a', repairs: '#14a378' } as const;
export const ACTIVITY_LABELS = { accessories: 'Accessoires', phones: 'Téléphones d’occasion', repairs: 'Réparations' } as const;

export interface Point {
  bucket: string;
  revenue: number;
  accessories: number;
  phones: number;
  repairs: number;
  delivery: number;
  directCosts: number;
  grossMargin: number;
  cashIn: number;
  expenses: number;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function bucketLabel(bucket: string, long = false) {
  const [y, m, d] = bucket.split('-');
  if (!d) return long ? `${MONTHS[Number(m) - 1]} ${y}` : MONTHS[Number(m) - 1];
  return long ? `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}` : `${Number(d)}/${m}`;
}

const compact = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k` : String(v));

const axis = { stroke: '#9a9ea6', fontSize: 12, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, rows }: TooltipProps<number, string> & { rows: { key: string; label: string; color: string }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="min-w-48 rounded-sm border border-line bg-surface px-3 py-2.5 text-[13px] shadow-pop">
      <p className="mb-1.5 font-medium text-ink">{bucketLabel(String(label), true)}</p>
      {rows.map((r) => (
        <p key={r.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-ink-2">
            <span className="size-2 rounded-xs" style={{ background: r.color }} aria-hidden="true" />
            {r.label}
          </span>
          <span className="num text-ink">{formatPrice(p[r.key as keyof Point] as number)}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ rows }: { rows: { key: string; label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2">
          <span className="h-2 w-3.5 rounded-xs" style={{ background: r.color }} aria-hidden="true" />
          {r.label}
        </li>
      ))}
    </ul>
  );
}

const ACTIVITY_ROWS = (['accessories', 'phones', 'repairs'] as const).map((k) => ({ key: k, label: ACTIVITY_LABELS[k], color: ACTIVITY_COLORS[k] }));

/** Chiffre d'affaires empilé par activité. */
export function RevenueChart({ data }: { data: Point[] }) {
  const empty = data.every((d) => d.accessories + d.phones + d.repairs === 0);
  return (
    <figure>
      <Legend rows={ACTIVITY_ROWS} />
      <div className="mt-3 h-64">
        {empty ? (
          <p className="flex h-full items-center justify-center text-[13.5px] text-muted">Aucune vente ni réparation terminée sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="#ece9e2" />
              <XAxis dataKey="bucket" tickFormatter={(v) => bucketLabel(v)} {...axis} minTickGap={16} />
              <YAxis tickFormatter={compact} {...axis} width={44} />
              <Tooltip cursor={{ fill: 'rgba(21,23,28,0.04)' }} content={<TooltipBox rows={[...ACTIVITY_ROWS].reverse()} />} />
              {ACTIVITY_ROWS.map((r, i) => (
                <Bar key={r.key} dataKey={r.key} stackId="ca" fill={r.color} stroke="#ffffff" strokeWidth={1} radius={i === ACTIVITY_ROWS.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <figcaption className="sr-only">Chiffre d’affaires par activité et par période.</figcaption>
    </figure>
  );
}

const MARGIN_ROWS = [
  { key: 'grossMargin', label: 'Marge brute', color: '#3461b5' },
  { key: 'expenses', label: 'Dépenses générales', color: '#d4782a' },
];

/** Marge brute et dépenses générales (même unité, un seul axe). */
export function MarginChart({ data }: { data: Point[] }) {
  const empty = data.every((d) => d.grossMargin === 0 && d.expenses === 0);
  return (
    <figure>
      <Legend rows={MARGIN_ROWS} />
      <div className="mt-3 h-56">
        {empty ? (
          <p className="flex h-full items-center justify-center text-[13.5px] text-muted">Aucune opération sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#ece9e2" />
              <XAxis dataKey="bucket" tickFormatter={(v) => bucketLabel(v)} {...axis} minTickGap={16} />
              <YAxis tickFormatter={compact} {...axis} width={44} />
              <Tooltip cursor={{ stroke: '#cdc8bd', strokeWidth: 1 }} content={<TooltipBox rows={MARGIN_ROWS} />} />
              {MARGIN_ROWS.map((r) => (
                <Line key={r.key} type="linear" dataKey={r.key} stroke={r.color} strokeWidth={2} dot={data.length <= 14 ? { r: 3, strokeWidth: 2, stroke: '#fff', fill: r.color } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}

/** Tableau des données des graphiques (alternative accessible). */
export function SeriesTable({ data }: { data: Point[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.08em] text-muted">
            <th className="py-2 pr-3 font-medium">Période</th>
            {['Accessoires', 'Téléphones', 'Réparations', 'Livraison', 'CA', 'Coûts directs', 'Marge brute', 'Encaissé', 'Dépenses'].map((h) => (
              <th key={h} className="px-2 text-right font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.bucket} className="border-b border-line last:border-0">
              <td className="py-1.5 pr-3">{bucketLabel(d.bucket, true)}</td>
              {[d.accessories, d.phones, d.repairs, d.delivery, d.revenue, d.directCosts, d.grossMargin, d.cashIn, d.expenses].map((v, i) => (
                <td key={i} className="num px-2 text-right">
                  {formatAmount(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
