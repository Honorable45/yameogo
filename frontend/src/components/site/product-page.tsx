import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatPrice } from '@/lib/format';
import { serverGet, serverGetOrNotFound } from '@/lib/server-api';
import type { CatalogDetail, ProductKind, PublicSettings } from '@/lib/types';
import { BackButton } from './back-button';
import { ProductView } from './product-view';

/** Fiche publique (revalidée toutes les 30 s : prix et stock suivent l'administration). */
async function load(slug: string, kind: ProductKind) {
  const data = await serverGetOrNotFound<CatalogDetail>(`/shop/catalog/${encodeURIComponent(slug)}`, 30);
  if (data === 'not-found' || (data && data.kind !== kind)) notFound();
  return data;
}

export async function productMetadata(slug: string, kind: ProductKind): Promise<Metadata> {
  const p = await load(slug, kind);
  if (!p) return { title: kind === 'PHONE' ? 'Smartphone' : 'Accessoire' };
  const base = `/${kind === 'PHONE' ? 'telephones' : 'accessoires'}/${p.slug}`;
  return {
    title: p.name,
    description: `${p.name}${p.priceFrom !== null ? ` — à partir de ${formatPrice(p.priceFrom)}` : ''}. ${p.description}`.slice(0, 160),
    alternates: { canonical: base },
    openGraph: { images: p.image?.url ? [{ url: p.image.url }] : undefined },
  };
}

export async function ProductPage({ slug, kind, configuration }: { slug: string; kind: ProductKind; configuration?: string }) {
  const [p, settings] = await Promise.all([load(slug, kind), serverGet<PublicSettings>('/settings/public', 60)]);
  if (!p) return <p className="container-page pt-40 text-center text-muted">Momentanément indisponible. Réessayez dans un instant.</p>;
  const listing = kind === 'PHONE' ? '/telephones' : '/accessoires';
  // Données structurées : chaque configuration est une offre avec son prix et sa disponibilité.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
    description: p.description || undefined,
    image: p.images.map((i) => i.url).filter(Boolean),
    offers: p.variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      name: v.label || p.name,
      price: v.price,
      priceCurrency: 'XOF',
      itemCondition: v.condition === 'USED' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
      availability: v.availability === 'OUT_OF_STOCK' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    })),
  };
  return (
    <div className="container-page pt-40 lg:pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <BackButton fallback={listing} className="mb-6" />
      <ProductView product={p} whatsapp={settings?.whatsapp ?? null} shopName={settings?.shopName ?? 'Le Marchand'} initialVariantId={configuration} />
    </div>
  );
}
