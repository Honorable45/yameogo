import { BadgeCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreLink, ProductGrid, SectionHeading, Stars } from '@/components/site/catalog';
import { HeroLogoAnimation } from '@/components/site/hero-logo-animation';
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

/** Photo d'accueil par défaut (Unsplash, licence libre), remplaçable dans l'admin : Paramètres › Photos du site. */
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1556656793-08538906a9f8';

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
  // Le slogan s'écrit pendant que le logo se compose, puis les boutons apparaissent.
  const taglineStart = 900;
  const taglineEnd = taglineStart + tagline.split(' ').length * 150 + 300;

  return (
    <>
      {/* Accueil : logo animé à gauche, slogan et boutons à droite (logo au-dessus du texte sur mobile). */}
      <section className="relative overflow-hidden bg-paper">
        {/* Photo de fond, éclaircie pour que le logo et le slogan restent lisibles. */}
        <Image src={settings?.heroImageUrl || DEFAULT_HERO} alt={settings?.heroImageAlt ?? ''} fill priority sizes="100vw" className="object-cover" />
        <span className="pointer-events-none absolute inset-0 bg-paper/80 lg:bg-transparent lg:bg-gradient-to-r lg:from-paper/70 lg:via-paper/80 lg:to-paper/90" aria-hidden="true" />
        <div className="container-page relative grid min-h-[88svh] items-center gap-6 pb-14 pt-36 lg:grid-cols-12 lg:gap-10 lg:pb-16 lg:pt-28">
          <div className="flex justify-center lg:col-span-6 lg:justify-start">
            <HeroLogoAnimation className="w-full max-w-[420px] sm:max-w-[500px] lg:max-w-[560px]" />
          </div>
          <div className="text-center lg:col-span-6 lg:pl-6 lg:text-left">
            <h1 className="display text-[40px] leading-[1.05] text-navy sm:text-[56px] lg:text-[68px]">
              <span className="sr-only">{shopName} — </span>
              <Reveal text={tagline} start={taglineStart} step={150} />
            </h1>
            <span aria-hidden="true" className="reveal-line mx-auto mt-7 block h-[3px] w-20 origin-left rounded-full bg-gradient-to-r from-ochre to-[#f9a51a] lg:mx-0" style={{ animationDelay: `${taglineEnd - 200}ms` }} />
            <nav aria-label="Rubriques" className="reveal-word mt-8 flex flex-wrap justify-center gap-3 lg:justify-start" style={{ animationDelay: `${taglineEnd}ms` }}>
              <Link href="/telephones" className="inline-flex h-12 items-center rounded-full bg-navy px-7 text-[15.5px] font-medium text-white shadow-card transition-transform hover:-translate-y-0.5">
                Smartphones
              </Link>
              <Link href="/accessoires" className="inline-flex h-12 items-center rounded-full border border-navy/25 bg-surface px-7 text-[15.5px] font-medium text-navy transition-colors hover:border-navy">
                Accessoires
              </Link>
              {promos.length > 0 && (
                <Link href="/promotions" className="inline-flex h-12 items-center rounded-full border border-ochre/40 bg-ochre-soft px-7 text-[15.5px] font-medium text-ochre-ink transition-colors hover:border-ochre">
                  Promotions
                </Link>
              )}
            </nav>
            <div className="reveal-word mt-6" style={{ animationDelay: `${taglineEnd + 250}ms` }}>
              <SocialLinks settings={settings} tone="dark" className="justify-center lg:justify-start" />
            </div>
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
