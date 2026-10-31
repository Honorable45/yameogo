import type { Metadata } from 'next';
import { CatalogListing, type CatalogSearch } from '@/components/site/catalog-listing';
import { PageHero } from '@/components/site/page-hero';

export const metadata: Metadata = {
  title: 'Smartphones',
  description: 'Smartphones neufs et d’occasion : choisissez couleur, mémoire et stockage, puis commandez sur WhatsApp.',
  alternates: { canonical: '/telephones' },
};

export default async function PhonesPage({ searchParams }: { searchParams: Promise<CatalogSearch> }) {
  const search = await searchParams;
  return (
    <>
      <PageHero title="Smartphones" image="/photos/rayons.webp" compact />
      <div className="container-page mt-8">
        <CatalogListing kind="PHONE" search={search} basePath="/telephones" />
      </div>
    </>
  );
}
