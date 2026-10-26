import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackButton } from '@/components/site/back-button';
import { BuyButton } from '@/components/site/buy-button';
import { ConditionBadge } from '@/components/site/catalog';
import { Gallery } from '@/components/site/gallery';
import { formatPrice } from '@/lib/format';
import { PHONE_CONDITIONS } from '@/lib/phone-conditions';
import { serverGet, serverGetOrNotFound } from '@/lib/server-api';
import type { PublicPhone, PublicSettings } from '@/lib/types';
import { waLink } from '@/lib/whatsapp';
import { SITE_URL } from '@/lib/site';

const SITE = SITE_URL;

async function load(slug: string) {
  const data = await serverGetOrNotFound<PublicPhone>(`/shop/phones/${encodeURIComponent(slug)}`, 30);
  if (data === 'not-found') notFound();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: 'Téléphone' };
  return {
    title: `${p.brand.name} ${p.title} ${PHONE_CONDITIONS[p.condition].label.toLowerCase()}`,
    description: `${p.brand.name} ${p.title} — ${formatPrice(p.price)}.`,
    alternates: { canonical: `/telephones/${p.slug}` },
    openGraph: { images: p.images[0]?.url ? [{ url: p.images[0].url }] : undefined },
  };
}

export default async function PhonePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, settings] = await Promise.all([load(slug), serverGet<PublicSettings>('/settings/public', 60)]);
  if (!p) return <p className="container-page pt-32 text-center text-muted">Momentanément indisponible.</p>;
  const isNew = p.condition === 'NEW';
  const specs: [string, string | null][] = [
    ['Stockage', p.storageGb ? `${p.storageGb} Go` : null],
    ['Couleur', p.color],
    ['État', isNew ? null : p.gradeLabel],
    ['Batterie', !isNew && p.batteryHealth !== null ? `${p.batteryHealth} %` : null],
    ['Défauts', isNew ? null : (p.knownDefects ?? 'Aucun')],
    ['Inclus', p.includedAccessories],
    ['Garantie', p.warrantyMonths > 0 ? `${p.warrantyMonths} mois` : null],
  ];
  const message = `Bonjour YAMEOGO, je souhaite acheter le ${p.brand.name} ${p.title} (${PHONE_CONDITIONS[p.condition].label.toLowerCase()}, réf. ${p.reference}) à ${formatPrice(p.price)}.\n\n${SITE}/telephones/${p.slug}`;

  return (
    <div className="container-page pt-40 lg:pt-32">
      <BackButton fallback="/boutique" className="mb-6" />
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-6">
          <Gallery images={p.images} alt={`${p.brand.name} ${p.title}`} aspect="portrait" />
        </div>
        <div className="lg:col-span-6">
          <div className="lg:sticky lg:top-28">
            <div className="flex items-center gap-3">
              <ConditionBadge condition={p.condition} />
              <span className="eyebrow">{p.brand.name}</span>
            </div>
            <h1 className="display mt-3 text-[36px] sm:text-[46px]">{p.modelName}</h1>
            <p className="num mt-5 text-[32px] font-semibold text-accent">{formatPrice(p.price)}</p>
            {p.status === 'RESERVED' && <p className="mt-1 text-[14px] text-warn">Réservé</p>}
            <BuyButton href={waLink(settings?.whatsapp, message)} size="lg" disabled={p.status !== 'AVAILABLE'} label="Acheter sur WhatsApp" className="mt-7 w-full" />
            <dl className="glass-light mt-7 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl p-5 text-[14.5px]">
              {specs
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12.5px] text-muted">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
