import { BadgeCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreLink, ProductGrid, SectionHeading, Stars } from '@/components/site/catalog';
import { SocialLinks } from '@/components/site/social';
import { formatDate } from '@/lib/format';
import { serverGet } from '@/lib/server-api';
import type { CatalogCard, CatalogFacets, Paginated, PublicSettings, ReviewsPage } from '@/lib/types';

export const revalidate = 60;

/** Texte révélé mot par mot ; `start` = délai avant le premier mot (ms). */
function Reveal({ text, start, step = 110 }: { text: string; start: number; step?: number }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span key={i}>
          {/* L'espace reste hors du bloc animé : un bloc « inline-block » absorberait l'espace final. */}
          <span className="reveal-word" style={{ animationDelay: `${start + i * step}ms` }}>
            {word}
          </span>{' '}
        </span>
      ))}
    </>
  );
}

/**
 * Nom de la boutique : premier mot lettre par lettre, puis la suite qui se resserre (« SMART TECH »).
 * Renvoie aussi l'instant où l'animation est terminée, pour enchaîner l'accroche.
 */
function HeroName({ name }: { name: string }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const letters = [...first];
  const restStart = 300 + letters.length * 85;
  return (
    <h1 aria-label={name}>
      <span aria-hidden="true" className="block text-[58px] font-semibold uppercase leading-[0.95] tracking-[0.1em] sm:text-[108px] lg:text-[136px]">
        {letters.map((l, i) => (
          <span key={i} className="reveal-letter" style={{ animationDelay: `${300 + i * 85}ms` }}>
            {l}
          </span>
        ))}
      </span>
      {rest.length > 0 && (
        <span aria-hidden="true" className="reveal-tracking mt-4 block pl-[0.46em] text-[15px] font-medium uppercase text-white/85 sm:mt-5 sm:text-[22px] lg:text-[26px]" style={{ animationDelay: `${restStart}ms` }}>
          {rest.join(' ')}
        </span>
      )}
    </h1>
  );
}

const list = (query: string) => serverGet<Paginated<CatalogCard>>(`/shop/catalog?${query}`, 60).then((r) => r?.items ?? []);

export default async function HomePage() {
  const [settings, phones, promos, accessories, facets, reviews] = await Promise.all([
    serverGet<PublicSettings>('/settings/public', 60),
    list('kind=PHONE&available=1&pageSize=8'),
    list('promo=1&available=1&pageSize=4'),
    list('kind=ACCESSORY&available=1&pageSize=8'),
    serverGet<CatalogFacets>('/shop/catalog-facets?kind=PHONE', 300),
    serverGet<ReviewsPage>('/reviews/public?pageSize=3', 300),
  ]);
  const shopName = settings?.shopName || 'Yameogo Smart Tech';
  const tagline = settings?.tagline || 'La qualité au meilleur prix';
  // Enchaînement : nom (lettres puis suite), trait, accroche mot par mot, puis les boutons.
  const nameEnd = 300 + [...shopName.split(' ')[0]].length * 85 + 700;
  const taglineStart = nameEnd + 500;
  const taglineEnd = taglineStart + tagline.split(' ').length * 140 + 300;

  return (
    <>
      {/* Accueil : image plein cadre */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-navy text-white">
        {settings?.heroImageUrl && <Image src={settings.heroImageUrl} alt={settings.heroImageAlt ?? ''} fill priority sizes="100vw" className="object-cover" />}
        {/* Voile uniforme : lisibilité du texte sur n'importe quelle photo. */}
        <span className="absolute inset-0 bg-navy/60" aria-hidden="true" />
        {/* Halo sombre au centre : contraste du nom quelle que soit la photo. */}
        <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(21_23_28/0.45),transparent_65%)]" aria-hidden="true" />
        <div className="relative px-6 pb-16 pt-40 text-center lg:pt-28">
          <HeroName name={shopName} />
          <span aria-hidden="true" className="reveal-line mx-auto mt-8 block h-px w-28 bg-gradient-to-r from-transparent via-white/80 to-transparent sm:mt-10 sm:w-40" style={{ animationDelay: `${nameEnd}ms` }} />
          <p className="mx-auto mt-6 max-w-2xl font-serif text-[22px] italic leading-snug text-white/90 sm:mt-8 sm:text-[30px]">
            <Reveal text={tagline} start={taglineStart} step={140} />
          </p>
          <nav aria-label="Rubriques" className="reveal-word mt-12 flex flex-wrap justify-center gap-3" style={{ animationDelay: `${taglineEnd}ms` }}>
            <Link href="/telephones" className="inline-flex h-12 items-center rounded-full bg-white px-7 text-[15.5px] font-medium text-navy transition-transform hover:-translate-y-0.5">
              Smartphones
            </Link>
            <Link href="/accessoires" className="glass inline-flex h-12 items-center rounded-full px-7 text-[15.5px] font-medium text-white transition-colors hover:bg-white/25">
              Accessoires
            </Link>
            {promos.length > 0 && (
              <Link href="/promotions" className="glass inline-flex h-12 items-center rounded-full px-7 text-[15.5px] font-medium text-white transition-colors hover:bg-white/25">
                Promotions
              </Link>
            )}
          </nav>
          <div className="reveal-word mt-6" style={{ animationDelay: `${taglineEnd + 250}ms` }}>
            <SocialLinks settings={settings} className="justify-center" />
          </div>
        </div>
      </section>

      {/* Marques */}
      {facets && facets.brands.length > 1 && (
        <nav aria-label="Marques" className="container-page mt-10">
          <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {facets.brands.map((b) => (
              <li key={b.slug}>
                <Link href={`/telephones?brand=${b.slug}`} className="inline-flex h-11 items-center whitespace-nowrap rounded-full border border-line-2 bg-surface px-5 text-[14.5px] font-medium hover:border-ink">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Smartphones */}
      {phones.length > 0 && (
        <section className="container-page mt-12 sm:mt-16">
          <SectionHeading title="Smartphones" action={<MoreLink href="/telephones">Tous les smartphones</MoreLink>} />
          <ProductGrid products={phones} className="mt-8" />
        </section>
      )}

      {/* Promotions */}
      {promos.length > 0 && (
        <section className="mt-16 bg-ochre-soft/60 py-14 sm:mt-24 sm:py-16">
          <div className="container-page">
            <SectionHeading title="Promotions" action={<MoreLink href="/promotions">Toutes les promotions</MoreLink>} />
            <ProductGrid products={promos} className="mt-8" />
          </div>
        </section>
      )}

      {/* Accessoires */}
      {accessories.length > 0 && (
        <section className="container-page mt-16 sm:mt-24">
          <SectionHeading title="Accessoires" action={<MoreLink href="/accessoires">Tous les accessoires</MoreLink>} />
          <ProductGrid products={accessories} className="mt-8" />
        </section>
      )}

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
