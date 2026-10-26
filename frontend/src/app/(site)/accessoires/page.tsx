import type { Metadata } from 'next';
import { CatalogListing, type CatalogSearch } from '@/components/site/catalog-listing';
import { PageHero } from '@/components/site/page-hero';

export const metadata: Metadata = {
  title: 'Accessoires',
  description: 'Coques, chargeurs, câbles, écouteurs, batteries externes, films de protection : commandez sur WhatsApp.',
  alternates: { canonical: '/accessoires' },
};

export default async function AccessoriesPage({ searchParams }: { searchParams: Promise<CatalogSearch> }) {
  const search = await searchParams;
  return (
    <>
      <PageHero title="Accessoires" compact />
      <div className="container-page mt-8">
        <CatalogListing kind="ACCESSORY" search={search} basePath="/accessoires" />
      </div>
    </>
  );
}
