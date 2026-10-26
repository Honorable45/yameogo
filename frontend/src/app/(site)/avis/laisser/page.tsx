import type { Metadata } from 'next';
import { PageHero } from '@/components/site/page-hero';
import { ReviewForm } from '@/components/site/review-form';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Donner mon avis',
  description: 'Notez votre achat chez YAMEOGO : produit, accueil, rapport qualité-prix.',
  alternates: { canonical: '/avis/laisser' },
};

export default async function LeaveReviewPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const settings = await serverGet<PublicSettings>('/settings/public', 60);
  return (
    <>
      <PageHero title="Votre avis" text="Avec le code reçu lors de votre achat. Une minute, sans compte." image={settings?.shopImageUrl} back="/avis" />
      <div className="container-page -mt-6 relative">
        <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <ReviewForm initialCode={code ?? ''} />
        </div>
      </div>
    </>
  );
}
