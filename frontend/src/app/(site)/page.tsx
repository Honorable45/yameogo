import { ArrowRight, BadgeCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreLink, ProductCard, SectionHeading, Stars } from '@/components/site/catalog';
import { PhonesShowcase } from '@/components/site/phones-showcase';
import { SocialLinks } from '@/components/site/social';
import { formatDate } from '@/lib/format';
import { serverGet } from '@/lib/server-api';
import type { PublicPhone, PublicProduct, PublicSettings, RepairCatalog, ReviewsPage } from '@/lib/types';

export const revalidate = 60;

const TAGLINE = 'Réparer, acheter et habiller votre téléphone';

/** Texte révélé mot par mot ; `start` = délai avant le premier mot (ms). */
function Reveal({ text, start, step = 110 }: { text: string; start: number; step?: number }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span key={i} className="reveal-word" style={{ animationDelay: `${start + i * step}ms` }}>
          {word}
          {' '}
        </span>
      ))}
    </>
  );
}

export default async function HomePage() {
  const [settings, products, phones, catalog, reviews] = await Promise.all([
    serverGet<PublicSettings>('/settings/public', 60),
    serverGet<PublicProduct[]>('/shop/featured', 60),
    serverGet<PublicPhone[]>('/shop/phones', 60),
    serverGet<RepairCatalog>('/repair-catalog', 300),
    serverGet<ReviewsPage>('/reviews/public?pageSize=3', 300),
  ]);
  const availablePhones = (phones ?? []).filter((p) => p.status === 'AVAILABLE');
  const taglineEnd = 500 + TAGLINE.split(' ').length * 110;

  return (
    <>
      {/* Accueil : image plein cadre */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-navy text-white">
        {settings?.heroImageUrl && <Image src={settings.heroImageUrl} alt={settings.heroImageAlt ?? ''} fill priority sizes="100vw" className="object-cover" />}
        {/* Voile uniforme : lisibilité du texte sur n'importe quelle photo. */}
        <span className="absolute inset-0 bg-navy/55" aria-hidden="true" />
        <div className="relative px-6 pb-16 pt-40 text-center lg:pt-28">
          <h1 className="display text-[64px] leading-none tracking-[-0.02em] sm:text-[104px] lg:text-[128px]">
            <Reveal text={settings?.shopName ?? 'YAMEOGO'} start={100} step={180} />
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-serif text-[22px] italic leading-snug text-white/90 sm:text-[30px]">
            <Reveal text={TAGLINE} start={500} />
          </p>
          <nav aria-label="Rubriques" className="reveal-word mt-12 flex flex-wrap justify-center gap-3" style={{ animationDelay: `${taglineEnd}ms` }}>
            {[
              ['/boutique', 'Téléphones'],
              ['/boutique?rayon=accessoires', 'Accessoires'],
              ['/reparation', 'Devis'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="glass inline-flex h-12 items-center rounded-full px-7 text-[15.5px] font-medium text-white transition-colors hover:bg-white/25">
                {label}
              </Link>
            ))}
          </nav>
          <div className="reveal-word mt-6" style={{ animationDelay: `${taglineEnd + 250}ms` }}>
            <SocialLinks settings={settings} className="justify-center" />
          </div>
        </div>
      </section>

      {/* Téléphones */}
      {availablePhones.length > 0 && (
        <section className="container-page mt-16 sm:mt-24">
          <SectionHeading title="Téléphones" action={<MoreLink href="/boutique">Tous les téléphones</MoreLink>} />
          <PhonesShowcase phones={availablePhones} whatsapp={settings?.whatsapp ?? null} />
        </section>
      )}

      {/* Accessoires */}
      {products && products.length > 0 && (
        <section className="container-page mt-16 sm:mt-24">
          <SectionHeading title="Accessoires" action={<MoreLink href="/boutique?rayon=accessoires">Tous les accessoires</MoreLink>} />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} whatsapp={settings?.whatsapp} />
            ))}
          </div>
        </section>
      )}

      {/* Devis */}
      <section className="relative mt-20 overflow-hidden bg-navy text-white sm:mt-28">
        {settings?.repairImageUrl && <Image src={settings.repairImageUrl} alt="" fill sizes="100vw" className="object-cover" />}
        <span className="absolute inset-0 bg-navy/65" aria-hidden="true" />
        <div className="container-page relative py-20 sm:py-28">
          <div className="glass mx-auto max-w-3xl rounded-3xl p-6 text-center sm:p-10">
            <h2 className="display text-[34px] sm:text-[46px]">Devis de réparation</h2>
            <p className="mt-2 text-[15.5px] text-white/80">Choisissez votre marque.</p>
            {catalog && (
              <ul className="mt-7 flex flex-wrap justify-center gap-2" aria-label="Marques">
                {[...catalog.brands.map((b) => ({ href: `/reparation?marque=${b.slug}`, label: b.name })), { href: '/reparation?marque=autre', label: 'Autre' }].map((b) => (
                  <li key={b.href}>
                    <Link href={b.href} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14.5px] font-medium text-navy transition-transform hover:-translate-y-0.5">
                      {b.label}
                      <ArrowRight className="size-4 text-ochre" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Avis */}
      {reviews && reviews.summary.count > 0 && reviews.summary.average !== null && (
        <section className="container-page mt-16 sm:mt-24">
          <SectionHeading title="Avis clients" action={<MoreLink href="/avis">Tous les avis</MoreLink>} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {reviews.items.map((r) => (
              <li key={r.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                <Stars value={r.rating} />
                {r.comment && <p className="mt-3 line-clamp-4 text-[15px] leading-relaxed">« {r.comment} »</p>}
                <p className="mt-auto flex items-center gap-2 pt-4 text-[12.5px] text-muted">
                  {formatDate(r.createdAt)}
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 font-medium text-ok">
                      <BadgeCheck className="size-3.5" /> Vérifié
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
