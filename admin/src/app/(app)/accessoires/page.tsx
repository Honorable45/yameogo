'use client';

import { Suspense } from 'react';
import { CatalogList } from '@/components/admin/catalog-list';
import { LoadingBlock } from '@/components/ui/spinner';

export default function AccessoriesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CatalogList kind="ACCESSORY" />
    </Suspense>
  );
}
