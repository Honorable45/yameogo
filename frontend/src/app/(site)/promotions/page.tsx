import type { Metadata } from 'next';
import { CatalogListing, type CatalogSearch } from '@/components/site/catalog-listing';
import { PageHero } from '@/components/site/page-hero';

export const metadata: Metadata = {
  title: 'Promotions',
  description: 'Smartphones et accessoires à prix réduit, dans la limite des stocks.',
  alternates: { canonical: '/promotions' },
};

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<CatalogSearch> }) {
  const search = await searchParams;
  return (
    <>
      <PageHero title="Promotions" text="Prix réduits, dans la limite des stocks." compact />
      <div className="container-page mt-8">
        <CatalogListing search={search} promo basePath="/promotions" />
      </div>
    </>
  );
}
