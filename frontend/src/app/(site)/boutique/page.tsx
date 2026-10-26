import { MapPin, Navigation, Package, Phone, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BackButton } from '@/components/site/back-button';
import { AccessoriesListing, PhonesListing, type Search } from '@/components/site/listings';
import { SocialLinks } from '@/components/site/social';
import { WhatsAppButton } from '@/components/site/whatsapp';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import { directionsUrl, embedMapUrl } from '@/lib/maps';
import { todayOpening } from '@/lib/opening';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';
import { waLink } from '@/lib/whatsapp';

export const metadata: Metadata = {
  title: 'Boutique',
  description: 'Téléphones neufs, venus et d’occasion, accessoires, et coordonnées de YAMEOGO. Achat sur WhatsApp.',
  alternates: { canonical: '/boutique' },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const rayon = sp.rayon === 'accessoires' ? 'accessoires' : 'telephones';
  const s = await serverGet<PublicSettings>('/settings/public', 60);
  const phone = s?.phone ?? '+22870858801';
  const address = [s?.addressLine, s?.city].filter(Boolean).join(', ');
  const opening = s ? todayOpening(s.openingHours) : null;
  const directions = directionsUrl(s);
  const map = embedMapUrl(s);

  const tabs = [
    { key: 'telephones', label: 'Téléphones', href: '/boutique', Icon: Smartphone },
    { key: 'accessoires', label: 'Accessoires', href: '/boutique?rayon=accessoires', Icon: Package },
  ] as const;

  return (
    <>
      {/* Contact */}
      <section id="contact" className="relative overflow-hidden bg-navy text-white">
        {s?.shopImageUrl && <Image src={s.shopImageUrl} alt={s.shopImageAlt ?? ''} fill priority sizes="100vw" className="object-cover" />}
        <span className="absolute inset-0 bg-navy/60" aria-hidden="true" />
        <div className="container-page relative pb-10 pt-40 lg:pt-32">
          <BackButton tone="dark" className="mb-6" />
          <div className="glass flex flex-col gap-5 rounded-3xl p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="display text-[38px] leading-none sm:text-[48px]">Boutique</h1>
              <div className="mt-3 flex flex-col gap-1.5 text-[14.5px] text-white/85 sm:flex-row sm:flex-wrap sm:gap-x-5">
                {opening && (
                  <span className="flex items-center gap-2">
                    <span className={cn('size-2.5 rounded-full', opening.open ? 'bg-[#6fd19c]' : 'bg-white/40')} aria-hidden="true" />
                    {opening.text}
                  </span>
                )}
                <a href={`tel:${phone}`} className="num flex items-center gap-2 hover:text-white">
                  <Phone className="size-4" /> {formatPhone(phone)}
                </a>
                {address && (
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4" /> {address}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WhatsAppButton href={waLink(s?.whatsapp, 'Bonjour YAMEOGO,')} size="md">
                WhatsApp
              </WhatsAppButton>
              <a href={`tel:${phone}`} className="glass inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14.5px] font-medium text-white hover:bg-white/25">
                <Phone className="size-4" /> Appeler
              </a>
              {directions && (
                <a href={directions} target="_blank" rel="noopener noreferrer" className="glass inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14.5px] font-medium text-white hover:bg-white/25">
                  <Navigation className="size-4" /> Itinéraire
                </a>
              )}
              <SocialLinks settings={s} className="[&>li:first-child]:hidden" />
            </div>
          </div>
        </div>
      </section>

      {/* Rayons */}
      <div className="container-page mt-8">
        <nav aria-label="Rayons" className="glass-light grid grid-cols-2 gap-1 rounded-full p-1.5 sm:inline-grid sm:min-w-[26rem]">
          {tabs.map(({ key, label, href, Icon }) => (
            <Link key={key} href={href} aria-current={rayon === key ? 'page' : undefined} className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-colors', rayon === key ? 'bg-navy text-white' : 'text-ink-2 hover:text-ink')}>
              <Icon className="size-[18px]" strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6">{rayon === 'accessoires' ? <AccessoriesListing sp={sp} whatsapp={s?.whatsapp ?? null} /> : <PhonesListing sp={sp} whatsapp={s?.whatsapp ?? null} />}</div>
      </div>

      {/* Venir à la boutique */}
      {map && directions && (
        <section id="itineraire" className="container-page mt-16 scroll-mt-40">
          <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card lg:grid lg:grid-cols-5">
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:col-span-2">
              <h2 className="display text-[30px] sm:text-[36px]">Venir à la boutique</h2>
              {address && (
                <p className="flex items-start gap-2 text-[15px] text-ink-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ochre" /> {address}
                </p>
              )}
              <a href={directions} target="_blank" rel="noopener noreferrer" className="glass-dark inline-flex h-12 items-center justify-center gap-2 self-start rounded-full px-6 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5">
                <Navigation className="size-4" /> Lancer l’itinéraire
              </a>
            </div>
            <iframe title={`Carte : ${s?.shopName ?? 'YAMEOGO'}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full border-0 sm:h-96 lg:col-span-3 lg:h-full lg:min-h-96" />
          </div>
        </section>
      )}
    </>
  );
}
