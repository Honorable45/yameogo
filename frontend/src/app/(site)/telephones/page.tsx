import type { Metadata } from 'next';
import { CatalogListing, type CatalogSearch } from '@/components/site/catalog-listing';
import { PageHero } from '@/components/site/page-hero';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Smartphones',
  description: 'Smartphones neufs et d’occasion : choisissez couleur, mémoire et stockage, puis commandez sur WhatsApp.',
  alternates: { canonical: '/telephones' },
};

export default async function PhonesPage({ searchParams }: { searchParams: Promise<CatalogSearch> }) {
  const [search, settings] = await Promise.all([searchParams, serverGet<PublicSettings>('/settings/public', 60)]);
  return (
    <>
      <PageHero title="Smartphones" image={settings?.phonesImageUrl} compact />
      <div className="container-page mt-8">
        <CatalogListing kind="PHONE" search={search} basePath="/telephones" />
      </div>
    </>
  );
}
