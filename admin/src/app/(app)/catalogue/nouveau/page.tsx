'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { GroupForm } from '@/components/admin/group-form';
import { PageHeader } from '@/components/admin/ui';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import type { BrandRow, CategoryRow } from '@/lib/admin-types';
import { useResource } from '@/lib/use-resource';

function NewGroup() {
  const kind = useSearchParams().get('type') === 'accessoire' ? 'ACCESSORY' : 'PHONE';
  const brands = useResource<BrandRow[]>('/brands');
  const categories = useResource<CategoryRow[]>(`/categories?kind=${kind}`);
  const back = kind === 'PHONE' ? { href: '/smartphones', label: 'Smartphones' } : { href: '/accessoires', label: 'Accessoires' };
  return (
    <>
      <PageHeader back={back} title={kind === 'PHONE' ? 'Nouveau smartphone' : 'Nouvel accessoire'} />
      <div className="max-w-4xl">
        {brands.error || categories.error ? (
          <ErrorState message={brands.error ?? categories.error!} />
        ) : !brands.data || !categories.data ? (
          <LoadingBlock />
        ) : (
          <GroupForm key={kind} kind={kind} brands={brands.data} categories={categories.data.filter((c) => c.active)} />
        )}
      </div>
    </>
  );
}

export default function NewGroupPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewGroup />
    </Suspense>
  );
}
