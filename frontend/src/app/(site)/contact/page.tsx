import { Clock, Mail, MapPin, Navigation, Phone, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { BackButton } from '@/components/site/back-button';
import { OpeningHours } from '@/components/site/opening-hours';
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
  title: 'Contact',
  description: 'Coordonnées, horaires, livraison et itinéraire de la boutique.',
  alternates: { canonical: '/contact' },
};

/** Contact et informations commerciales : seules les informations renseignées dans Paramètres apparaissent. */
export default async function ContactPage() {
  const s = await serverGet<PublicSettings>('/settings/public', 60);
  const shopName = s?.shopName ?? 'YAMEOGO';
  const address = [s?.addressLine, s?.city, s?.country].filter(Boolean).join(', ');
  const opening = s?.openingHours.length ? todayOpening(s.openingHours) : null;
  const directions = directionsUrl(s);
  const map = embedMapUrl(s);

  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        {s?.shopImageUrl && <Image src={s.shopImageUrl} alt={s.shopImageAlt ?? ''} fill priority sizes="100vw" className="object-cover" />}
        <span className="absolute inset-0 bg-navy/65" aria-hidden="true" />
        <div className="container-page relative pb-10 pt-40 lg:pt-32">
          <BackButton tone="dark" className="mb-6" />
          <div className="glass rounded-3xl p-6 sm:p-8">
            <h1 className="display text-[38px] leading-none sm:text-[48px]">Contact</h1>
            <ul className="mt-5 space-y-2.5 text-[15px] text-white/90">
              {opening && (
                <li className="flex items-center gap-2.5">
                  <span className={cn('size-2.5 rounded-full', opening.open ? 'bg-[#6fd19c]' : 'bg-white/40')} aria-hidden="true" />
                  {opening.text}
                </li>
              )}
              {s?.phone && (
                <li>
                  <a href={`tel:${s.phone}`} className="num inline-flex items-center gap-2.5 hover:text-white">
                    <Phone className="size-4" /> {formatPhone(s.phone)}
                  </a>
                </li>
              )}
              {s?.email && (
                <li>
                  <a href={`mailto:${s.email}`} className="inline-flex items-center gap-2.5 hover:text-white">
                    <Mail className="size-4" /> {s.email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-center gap-2.5">
                  <MapPin className="size-4 shrink-0" /> {address}
                </li>
              )}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <WhatsAppButton href={waLink(s?.whatsapp, `Bonjour ${shopName},`)} size="md">
                Écrire sur WhatsApp
              </WhatsAppButton>
              {s?.phone && (
                <a href={`tel:${s.phone}`} className="glass inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14.5px] font-medium text-white hover:bg-white/25">
                  <Phone className="size-4" /> Appeler
                </a>
              )}
              {directions && (
                <a href={directions} target="_blank" rel="noopener noreferrer" className="glass inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14.5px] font-medium text-white hover:bg-white/25">
                  <Navigation className="size-4" /> Itinéraire
                </a>
              )}
              <SocialLinks settings={s} withoutWhatsApp />
            </div>
          </div>
        </div>
      </section>

      <div className="container-page mt-12 grid gap-6 md:grid-cols-2">
        {s?.openingHours.length ? (
          <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Clock className="size-4 text-muted" /> Horaires
            </h2>
            <OpeningHours hours={s.openingHours} className="mt-4" />
          </section>
        ) : null}
        {s?.deliveryInfo && (
          <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Truck className="size-4 text-muted" /> Livraison et paiement
            </h2>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{s.deliveryInfo}</p>
          </section>
        )}
      </div>

      {map && directions && (
        <section id="itineraire" className="container-page mt-6 scroll-mt-40">
          <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card lg:grid lg:grid-cols-5">
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:col-span-2">
              <h2 className="display text-[30px] sm:text-[36px]">Venir à la boutique</h2>
              {address && (
                <p className="flex items-start gap-2 text-[15px] text-ink-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" /> {address}
                </p>
              )}
              <a href={directions} target="_blank" rel="noopener noreferrer" className="glass-dark inline-flex h-12 items-center justify-center gap-2 self-start rounded-full px-6 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5">
                <Navigation className="size-4" /> Lancer l’itinéraire
              </a>
            </div>
            <iframe title={`Carte : ${shopName}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full border-0 sm:h-96 lg:col-span-3 lg:h-full lg:min-h-96" />
          </div>
        </section>
      )}
    </>
  );
}
