import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BackButton } from '@/components/site/back-button';
import { BuyButton } from '@/components/site/buy-button';
import { availabilityText, ProductCard, SectionHeading } from '@/components/site/catalog';
import { Gallery } from '@/components/site/gallery';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { serverGet, serverGetOrNotFound } from '@/lib/server-api';
import type { PublicProduct, PublicSettings } from '@/lib/types';
import { buyMessage, waLink } from '@/lib/whatsapp';
import { SITE_URL } from '@/lib/site';

const SITE = SITE_URL;

async function load(slug: string) {
  const data = await serverGetOrNotFound<{ product: PublicProduct; related: PublicProduct[] }>(`/shop/products/${encodeURIComponent(slug)}`, 30);
  if (data === 'not-found') notFound();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: 'Accessoire' };
  const p = data.product;
  return {
    title: p.name,
    description: p.description.slice(0, 155) || `${p.name} — ${formatPrice(p.price)}`,
    alternates: { canonical: `/accessoires/${p.slug}` },
    openGraph: { title: p.name, images: p.images[0]?.url ? [{ url: p.images[0].url }] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([load(slug), serverGet<PublicSettings>('/settings/public', 60)]);
  if (!data) return <p className="container-page pt-32 text-center text-muted">Momentanément indisponible.</p>;
  const { product: p, related } = data;
  const status = availabilityText(p.availability, p.availableQuantity);
  const out = p.availability === 'OUT_OF_STOCK';
  const compat = [...new Set(p.compatibility.map((c) => (c.model ? `${c.brand} ${c.model}` : c.brand)))];
  const message = buyMessage({ name: p.name, price: p.price, ref: p.sku, url: `${SITE}/accessoires/${p.slug}` });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    description: p.description,
    image: p.images.map((i) => i.url).filter(Boolean),
    offers: { '@type': 'Offer', price: p.price, priceCurrency: 'XOF', availability: out ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' },
  };

  return (
    <div className="container-page pt-40 lg:pt-32">
      <BackButton fallback="/boutique?rayon=accessoires" className="mb-6" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <Gallery images={p.images} alt={p.name} />
        </div>
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <h1 className="display text-[32px] sm:text-[40px]">{p.name}</h1>
            <p className="num mt-5 text-[30px] font-semibold text-accent">{formatPrice(p.price)}</p>
            <p className={cn('mt-1 flex items-center gap-2 text-[14px]', status.tone)}>
              <span className={cn('size-2 rounded-full', status.dot)} aria-hidden="true" />
              {status.text}
            </p>
            <BuyButton href={waLink(settings?.whatsapp, message)} size="lg" disabled={out} className="mt-7 w-full" />
            {compat.length > 0 && <p className="mt-7 text-[14px] text-ink-2"><span className="text-muted">Compatible : </span>{compat.join(', ')}</p>}
            {p.description && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{p.description}</p>}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <SectionHeading title="Vous aimerez aussi" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:gap-5">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
